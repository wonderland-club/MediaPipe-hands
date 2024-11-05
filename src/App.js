import React, { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./App.css";
import { connectMqtt, sendMessage, disconnectMqtt } from "./utils/mqttClient";

const HandGestureRecognizer = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 初始化状态，存储左右手每根手指是否张开的状态
  const [leftHandFingers, setLeftHandFingers] = useState({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });
  const [rightHandFingers, setRightHandFingers] = useState({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });

  useEffect(() => {
    if (videoRef.current && canvasRef.current) {
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 1280,
        height: 720,
      });
      camera.start();
    }
  }, []);

  function onResults(results) {
    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    if (results.multiHandLandmarks) {
      results.multiHandLandmarks.forEach((landmarks, i) => {
        const handedness = results.multiHandedness[i].label; // 左手或右手
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 5,
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: "#FF0000",
          lineWidth: 2,
        });

        detectFingers(landmarks, handedness);
      });
    }
    canvasCtx.restore();
  }

  function detectFingers(landmarks, handLabel) {
    const fingerJoints = {
      thumb: [1, 2, 4],
      index: [5, 6, 8],
      middle: [9, 10, 12],
      ring: [13, 14, 16],
      pinky: [17, 18, 20],
    };

    const newFingerStates = {};

    for (let finger in fingerJoints) {
      const [base, pip, tip] = fingerJoints[finger].map(
        (index) => landmarks[index]
      );

      if (finger === "thumb") {
        // 对于右手拇指，基于X轴的判断
        if (handLabel === "Right") {
          newFingerStates[finger] = base.x > tip.x;
        }
        // 对于左手拇指，基于X轴的判断相反
        else if (handLabel === "Left") {
          newFingerStates[finger] = base.x < tip.x;
        }
      } else {
        // 其他手指仍基于Y轴的标准判断
        newFingerStates[finger] = tip.y < pip.y && pip.y < base.y;
      }
    }

    if (handLabel === "Left") {
      setLeftHandFingers(newFingerStates);
    } else if (handLabel === "Right") {
      setRightHandFingers(newFingerStates);
    }
  }

  return (
    <div>
      <div className="finger-visualization">
        <div className="hand left-hand">
          {Object.keys(leftHandFingers).map((finger) => (
            <div
              key={finger}
              className={`finger ${
                leftHandFingers[finger] ? "open" : "closed"
              }`}
            />
          ))}
        </div>
        <div className="hand right-hand">
          {Object.keys(rightHandFingers).map((finger) => (
            <div
              key={finger}
              className={`finger ${
                rightHandFingers[finger] ? "open" : "closed"
              }`}
            />
          ))}
        </div>
      </div>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} width={1280} height={720} />
    </div>
  );
};

function App() {
  const [message, setMessage] = useState(""); // 用于保存输入框中的消息

  useEffect(() => {
    // 组件加载时连接到 MQTT 服务器
    connectMqtt();

    // 组件卸载时断开连接
    return () => {
      disconnectMqtt(); // 在组件卸载时断开 MQTT 连接
    };
  }, []);

  // 处理输入框变化
  const handleInputChange = (e) => {
    setMessage(e.target.value); // 更新输入框中的值
  };

  // 处理发送按钮点击事件
  const handleSendMessage = () => {
    if (message.trim() !== "") {
      sendMessage("name", message); // 发送消息到 'name' 主题
      setMessage(""); // 清空输入框
    } else {
      console.log("输入框为空，无法发送消息");
    }
  };

  return (
    <div className="App">
      <div>
        <div>
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Enter your message"
          />
          <button onClick={handleSendMessage}>Send Message</button>
        </div>
        <HandGestureRecognizer />
      </div>
    </div>
  );
}

export default App;
