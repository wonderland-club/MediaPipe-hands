// src/utils/mqttClient.js
import mqtt from "mqtt";

/**
 * MQTT客户端模块
 * 负责与MQTT服务器的连接、消息发送和断开连接
 */

let client; // 保存全局的client实例
let reconnectTimer = null;
let isConnecting = false;
const MAX_RECONNECT_DELAY = 5000; // 最大重连延迟时间（毫秒）
let reconnectAttempts = 0; // 重连尝试次数
const MAX_RECONNECT_ATTEMPTS = 10; // 最大重连尝试次数
let savedCallbacks = { onConnect: null, onMessage: null }; // 保存回调函数



/**
 * 连接到MQTT服务器
 * @param {Function} onConnectCallback - 连接成功时的回调函数
 * @param {Function} onMessageCallback - 收到消息时的回调函数
 * @returns {Promise} 连接结果的Promise
 */
const connectMqtt = (onConnectCallback, onMessageCallback) => {
  return new Promise((resolve, reject) => {
    if (isConnecting) {
      reject(new Error("MQTT连接正在进行中"));
      return;
    }

    if (client && client.connected) {
      resolve(client);
      return;
    }

    // 保存回调函数，以便在重连时使用
    if (onConnectCallback) savedCallbacks.onConnect = onConnectCallback;
    if (onMessageCallback) savedCallbacks.onMessage = onMessageCallback;
    
    isConnecting = true;
    reconnectAttempts = 0; // 重置重连尝试次数
    
    try {
      // 创建MQTT客户端实例
      client = mqtt.connect("wss://guest:test@mqtt.aimaker.space:8084/mqtt", {
        reconnectPeriod: 0, // 禁用自动重连，我们将自己处理重连逻辑
        connectTimeout: 5000 // 连接超时时间
      });

      // 处理连接事件
      client.on("connect", () => {
        console.log("Connected to MQTT broker");
        isConnecting = false;
        
        // 清除重连定时器
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        
        // 调用连接成功回调
        if (typeof onConnectCallback === "function") {
          onConnectCallback();
        }
        
        resolve(client);
      });

      // 处理消息事件
      if (typeof onMessageCallback === "function") {
        client.on("message", (topic, message) => {
          onMessageCallback(topic, message.toString());
        });
      }

      // 处理错误
      client.on("error", (error) => {
        console.error(`MQTT connection error: ${error}`);
        isConnecting = false;
        reject(error);
      });

      // 处理连接断开
      client.on("close", () => {
        console.log("MQTT client disconnected");
        isConnecting = false;
        
        // 设置重连定时器
        if (!reconnectTimer && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          // 使用指数退避策略，但最大不超过MAX_RECONNECT_DELAY
          reconnectAttempts++;
          const delay = Math.min(Math.random() * 3000 + 1000, MAX_RECONNECT_DELAY);
          console.log(`Will attempt to reconnect in ${Math.round(delay/1000)} seconds (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            console.log("Attempting to reconnect to MQTT broker...");
            // 使用保存的回调函数进行重连
            connectMqtt(savedCallbacks.onConnect, savedCallbacks.onMessage)
              .then(() => {
                console.log("Reconnection successful");
                reconnectAttempts = 0; // 重连成功后重置尝试次数
              })
              .catch(err => {
                console.error("Reconnection failed:", err);
                // 如果重连失败，立即设置新的重连定时器
                if (!reconnectTimer && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  const nextDelay = Math.min(delay * 1.5, MAX_RECONNECT_DELAY);
                  console.log(`Scheduling next reconnection attempt in ${Math.round(nextDelay/1000)} seconds`);
                  reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    connectMqtt(savedCallbacks.onConnect, savedCallbacks.onMessage)
                      .then(() => {
                        console.log("Reconnection successful on second attempt");
                        reconnectAttempts = 0; // 重连成功后重置尝试次数
                      })
                      .catch(e => console.error("Second reconnection attempt failed:", e));
                  }, nextDelay);
                } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                  console.error("Maximum reconnection attempts reached. Giving up.");
                }
              });
          }, delay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error("Maximum reconnection attempts reached. Giving up.");
        }
      });
    } catch (error) {
      console.error("MQTT connection setup error:", error);
      isConnecting = false;
      reject(error);
    }
  });
};

/**
 * 订阅MQTT主题
 * @param {string} topic - 要订阅的主题
 * @returns {Promise} 订阅结果的Promise
 */
const subscribeTopic = (topic) => {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error("MQTT client not connected"));
      return;
    }

    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err);
        reject(err);
      } else {
        console.log(`Subscribed to topic: ${topic}`);
        resolve();
      }
    });
  });
};

/**
 * 发送消息到指定的主题
 * @param {string} topic - 目标主题
 * @param {string} message - 要发送的消息
 * @param {boolean} [silentFail=false] - 如果为true，则在客户端未连接时不会抛出错误，而是静默失败
 * @returns {Promise} 发送结果的Promise
 */
const sendMessage = (topic, message, silentFail = true) => {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      console.warn(`MQTT client not connected. Cannot send message to topic: ${topic}`);
      
      // 如果客户端未连接但不在重连过程中，尝试重新连接
      if (!isConnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log("Attempting to reconnect before sending message...");
        connectMqtt(savedCallbacks.onConnect, savedCallbacks.onMessage)
          .then(() => {
            // 连接成功后重新尝试发送消息
            return sendMessage(topic, message, silentFail);
          })
          .then(resolve)
          .catch(err => {
            console.error("Failed to reconnect and send message:", err);
            if (silentFail) {
              resolve({ success: false, reason: 'reconnect_failed' });
            } else {
              reject(err);
            }
          });
        return;
      }
      
      if (silentFail) {
        // 静默失败，不抛出错误，只返回失败状态
        resolve({ success: false, reason: 'not_connected' });
      } else {
        reject(new Error("MQTT client not connected"));
      }
      return;
    }

    client.publish(topic, message, (err) => {
      if (!err) {
        console.log(`Message sent to topic ${topic}: ${message}`);
        resolve({ success: true });
      } else {
        console.error("Failed to send message:", err);
        reject(err);
      }
    });
  });
};

/**
 * 断开MQTT连接
 */
const disconnectMqtt = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectAttempts = 0; // 重置重连尝试次数

  if (client) {
    client.end(); // 安全断开连接
    client = null; // 清空客户端实例
    console.log("MQTT connection terminated");
  }
};

/**
 * 检查MQTT连接状态
 * @returns {boolean} 连接状态
 */
const isConnected = () => {
  return !!(client && client.connected);
};

export { connectMqtt, subscribeTopic, sendMessage, disconnectMqtt, isConnected };
