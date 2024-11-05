// src/mqttClient.js
import mqtt from "mqtt";

let client; // 在 mqttClient.js 中保存全局的 client 实例

// 连接到 MQTT 服务器
const connectMqtt = () => {
  if (!client) {
    client = mqtt.connect("wss://guest:test@mqtt.aimaker.space:8084/mqtt");

    // 处理连接事件
    client.on("connect", () => {
      console.log("Connected to MQTT broker");
    });

    // 处理错误
    client.on("error", (error) => {
      console.error(`MQTT connection error: ${error}`);
    });

    // 处理连接断开
    client.on("close", () => {
      console.log("MQTT client disconnected");
    });
  }
};

// 发送消息到指定的主题
const sendMessage = (topic, message) => {
  if (client && client.connected) {
    client.publish(topic, message, (err) => {
      if (!err) {
        console.log(`Message sent to topic ${topic}: ${message}`);
      } else {
        console.error("Failed to send message:", err);
      }
    });
  } else {
    console.error("Client is not connected");
  }
};

// 断开 MQTT 连接
const disconnectMqtt = () => {
  if (client) {
    client.end(); // 安全断开连接
    client = null; // 清空客户端实例
  }
};

export { connectMqtt, sendMessage, disconnectMqtt };
