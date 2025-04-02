import React, { useEffect, useRef } from "react";
import "./App.css";
import { connectMqtt, disconnectMqtt } from "./utils/mqttClient";
import HandGestureRecognizer from "./components/HandGestureRecognizer";
import MessageInput from "./components/MessageInput";
import VideoPlayer from "./components/VideoPlayer";

/**
 * 主应用组件
 * 负责整合所有子组件并管理应用状态
 */
function App() {
  // 添加播放视频的 ref
  const playbackVideoRef = useRef(null);

  useEffect(() => {
    // 组件加载时连接到 MQTT 服务器
    connectMqtt(
      // 连接成功回调
      () => {
        console.log("MQTT连接成功，应用已准备就绪");
      },
      // 消息接收回调
      (topic, message) => {
        console.log(`收到来自主题 ${topic} 的消息: ${message}`);
      }
    ).catch((error) => {
      console.error("MQTT连接失败:", error);
    });

    // 组件卸载时断开连接
    return () => {
      disconnectMqtt(); // 在组件卸载时断开 MQTT 连接
    };
  }, []);

  return (
    <div className="App">
      <main className="App-main">
        <section
          className="video-section"
          style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          {/* 修改：添加内联样式使视频居中 */}
          <div className="video-container" style={{ display: "flex", justifyContent: "center" }}>
            {/* 使用VideoPlayer组件替代直接的video标签，并禁用所有手动控制 */}
            <VideoPlayer
              videoSrc={process.env.PUBLIC_URL + "/videos/songyuqi.mp4"}
              videoRef={playbackVideoRef}
              controls={false}  // 禁用手动控制（隐藏音量、暂停、播放等按钮）
              loop={true}
              onVideoRefChange={() => console.log("视频引用已更新")}
            />
          </div>
        </section>

        <section className="gesture-section">
          {/* 传入 playbackVideoRef 以实现手势控制视频播放 */}
          <HandGestureRecognizer videoPlaybackRef={playbackVideoRef} />
        </section>
      </main>
    </div>
  );
}

export default App;
