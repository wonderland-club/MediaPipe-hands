import React, { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { sendMessage, isConnected } from "../utils/mqttClient";
import "./HandGestureRecognizer.css";

/**
 * 手势识别组件
 * 负责识别手势并触发相应的事件
 * @param {Object} props - 组件属性
 * @param {React.RefObject} props.videoPlaybackRef - 视频播放元素的引用
 */
const HandGestureRecognizer = ({ videoPlaybackRef }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mqttConnected, setMqttConnected] = useState(isConnected());

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
  const [prevThumbState, setPrevThumbState] = useState({
    left: false,
    right: false
  });

  // 用 useRef 存储上一次左右手的整体状态
  const prevHandAggregate = useRef({
    left: { allOpen: false, allClosed: false },
    right: { allOpen: false, allClosed: false },
  });
  
  // 用 useRef 存储两只手总体的状态，防止重复发送消息
  const prevBothAggregate = useRef({ allOpen: false, allClosed: false });

  // 定期检查MQTT连接状态
  useEffect(() => {
    const checkConnectionInterval = setInterval(() => {
      setMqttConnected(isConnected());
    }, 2000); // 每2秒检查一次连接状态
    
    return () => {
      clearInterval(checkConnectionInterval);
    };
  }, []);

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

      // 清理函数
      return () => {
        camera.stop();
      };
    }
  }, []);

  /**
   * 处理MediaPipe手势识别结果
   * @param {Object} results - MediaPipe识别结果
   */
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

  /**
   * 检测手指状态
   * @param {Array} landmarks - 手部关键点数据
   * @param {String} handLabel - 手的标识（Left或Right）
   */
  function detectFingers(landmarks, handLabel) {
    // 定义每个手指关键关节的索引
    const fingerJoints = {
      thumb: [1, 2, 4],
      index: [5, 6, 8],
      middle: [9, 10, 12],
      ring: [13, 14, 16],
      pinky: [17, 18, 20],
    };

    // 存储本次检测到的手指状态
    const newFingerStates = {};

    // 判断每个手指是否伸展
    for (let finger in fingerJoints) {
      const [base, pip, tip] = fingerJoints[finger].map(index => landmarks[index]);

      if (finger === "thumb") {
        // 拇指根据左右手方向判断
        if (handLabel === "Right") {
          newFingerStates[finger] = base.x > tip.x;
        } else if (handLabel === "Left") {
          newFingerStates[finger] = base.x < tip.x;
        }
      } else {
        // 其他手指：末端位于近中节之上且近中节位于基点之上则认为伸展
        newFingerStates[finger] = tip.y < pip.y && pip.y < base.y;
      }
    }

    // 计算当前手的整体状态
    const allOpen = Object.values(newFingerStates).every(v => v === true);
    const allClosed = Object.values(newFingerStates).every(v => v === false);

    if (handLabel === "Left") {
      setLeftHandFingers(newFingerStates);

      // 检测左手所有手指全部张开（仅首次状态变化时发送）
      if (allOpen && !prevHandAggregate.current.left.allOpen) {
        sendMessage("left-all", "Left-All-Open");
      }
      // 检测左手所有手指全部合并（仅首次状态变化时发送）
      if (allClosed && !prevHandAggregate.current.left.allClosed) {
        sendMessage("left-all", "Left-All-Closed");
      }
      setPrevThumbState(prev => ({ ...prev, left: newFingerStates.thumb }));
      prevHandAggregate.current.left = { allOpen, allClosed };
    } else if (handLabel === "Right") {
      setRightHandFingers(newFingerStates);

      // 检测右手所有手指全部张开
      if (allOpen && !prevHandAggregate.current.right.allOpen) {
        sendMessage("right-all", "Right-All-Open");
      }
      // 检测右手所有手指全部合并
      if (allClosed && !prevHandAggregate.current.right.allClosed) {
        sendMessage("right-all", "Right-All-Closed");
      }
      setPrevThumbState(prev => ({ ...prev, right: newFingerStates.thumb }));
      prevHandAggregate.current.right = { allOpen, allClosed };
    }
  }

  // 当左右手状态更新后，检测是否同时满足两只手全部张开或全部合并
  useEffect(() => {
    const leftAllOpen =
      Object.keys(leftHandFingers).length > 0 &&
      Object.values(leftHandFingers).every(v => v === true);
    const leftAllClosed =
      Object.keys(leftHandFingers).length > 0 &&
      Object.values(leftHandFingers).every(v => v === false);
    const rightAllOpen =
      Object.keys(rightHandFingers).length > 0 &&
      Object.values(rightHandFingers).every(v => v === true);
    const rightAllClosed =
      Object.keys(rightHandFingers).length > 0 &&
      Object.values(rightHandFingers).every(v => v === false);

    const bothOpen = leftAllOpen && rightAllOpen;
    const bothClosed = leftAllClosed && rightAllClosed;

    // 仅在状态首次变化为全部张开时发送事件
    if (bothOpen && !prevBothAggregate.current.allOpen) {
      sendMessage("all", "Both-All-Open");
      prevBothAggregate.current.allOpen = true;
    } else if (!bothOpen) {
      prevBothAggregate.current.allOpen = false;
    }

    // 仅在状态首次变化为全部合并时发送事件
    if (bothClosed && !prevBothAggregate.current.allClosed) {
      sendMessage("all", "Both-All-Closed");
      prevBothAggregate.current.allClosed = true;
    } else if (!bothClosed) {
      prevBothAggregate.current.allClosed = false;
    }

    // 添加视频播放/暂停逻辑
    if (videoPlaybackRef && videoPlaybackRef.current) {
      if (bothOpen && videoPlaybackRef.current.paused) {
        videoPlaybackRef.current.play();
      } else if (bothClosed && !videoPlaybackRef.current.paused) {
        videoPlaybackRef.current.pause();
      }
    }
  }, [leftHandFingers, rightHandFingers, videoPlaybackRef]);

  return (
    <div>
      <div className="connection-status">
        <div className={`status-indicator ${mqttConnected ? 'connected' : 'disconnected'}`}>
          MQTT状态: {mqttConnected ? '已连接' : '未连接'}
        </div>
      </div>
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

export default HandGestureRecognizer;