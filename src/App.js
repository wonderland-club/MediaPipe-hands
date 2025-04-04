import React, { useEffect, useRef } from "react";
import "./App.css";
import { connectMqtt, disconnectMqtt } from "./utils/mqttClient";
import HandGestureRecognizer from "./components/HandGestureRecognizer";
import VideoPlayer from "./components/VideoPlayer";

// 主应用组件：负责连接MQTT、视频播放和手势控制
function App() {
  const playbackVideoRef = useRef(null);

  useEffect(() => {
    // 连接 MQTT 服务器，打印连接状态
    connectMqtt(
      () => console.log("MQTT连接成功，应用已准备就绪"),
      (topic, message) => console.log(`收到主题 ${topic} 消息: ${message}`)
    ).catch(error => console.error("MQTT连接失败:", error));

    return () => disconnectMqtt();
  }, []);

  return (
    <div className="App">
      <main className="App-main">
        <section className="video-section" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          {/* 视频播放器：使用 VideoPlayer 组件，禁用所有手动控制，并开启循环播放 */}
          <div className="video-container" style={{ display: "flex", justifyContent: "center" }}>
            <VideoPlayer
              videoSrc={process.env.PUBLIC_URL + "/videos/songyuqi.mp4"}
              videoRef={playbackVideoRef}
              controls={false}
              loop={true}
              onVideoRefChange={() => console.log("视频引用已更新")}
            />
          </div>
        </section>
        <section className="gesture-section">
          {/* 传入视频引用用于手势控制视频播放 */}
          <HandGestureRecognizer videoPlaybackRef={playbackVideoRef} />
        </section>
      </main>
    </div>
  );
}

export default App;
