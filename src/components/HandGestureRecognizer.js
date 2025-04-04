import React, { useEffect, useRef, useState } from "react";
import { Hands, HAND_CONNECTIONS } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { sendMessage, isConnected } from "../utils/mqttClient";
import "./HandGestureRecognizer.css";

// 全局常量：手指关键关节索引
const FINGER_JOINTS = {
  thumb: [1, 2, 4],
  index: [5, 6, 8],
  middle: [9, 10, 12],
  ring: [13, 14, 16],
  pinky: [17, 18, 20],
};

// 手势识别组件：处理摄像头数据、绘图和手势事件
const HandGestureRecognizer = ({ videoPlaybackRef }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [mqttConnected, setMqttConnected] = useState(isConnected());
  const [rightHandFingers, setRightHandFingers] = useState({ thumb: null, index: null, middle: null, ring: null, pinky: null });
  const [leftHandFingers, setLeftHandFingers] = useState({ thumb: null, index: null, middle: null, ring: null, pinky: null });
  const [prevThumbState, setPrevThumbState] = useState({ right: false, left: false });
  
  // 保存上次整体状态，防止重复消息
  const prevHandAggregate = useRef({ right: { allOpen: false, allClosed: false }, left: { allOpen: false, allClosed: false } });
  const prevBothAggregate = useRef({ allOpen: false, allClosed: false });

  // 定时检测 MQTT 连接状态
  useEffect(() => {
    const timer = setInterval(() => setMqttConnected(isConnected()), 2000);
    return () => clearInterval(timer);
  }, []);

  // 初始化 MediaPipe Hands
  useEffect(() => {
    if (videoRef.current && canvasRef.current) {
      const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(handleResults);

      const camera = new Camera(videoRef.current, { 
        onFrame: async () => await hands.send({ image: videoRef.current }), 
        width: 1280, height: 720 
      });
      camera.start();
      return () => camera.stop();
    }
  }, []);

  // 处理媒体识别结果：绘制画布、提取左右手数据
  function handleResults(results) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      let leftLandmarks = null, rightLandmarks = null;
      results.multiHandLandmarks.forEach((landmarks, i) => {
        const label = results.multiHandedness[i].label;
        // 绘制手部图形
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
        drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 2 });
        // 镜像处理：MediaPipe "Left" 实际为用户右手，"Right" 为用户左手
        if (label === "Left") rightLandmarks = landmarks;
        else if (label === "Right") leftLandmarks = landmarks;
      });

      if (leftLandmarks && rightLandmarks) {
        updateFingers(leftLandmarks, "Left");
        updateFingers(rightLandmarks, "Right");
      } else {
        // 未同时检测到左右手，重置缺失手的状态
        if (!rightLandmarks) setRightHandFingers({ thumb: null, index: null, middle: null, ring: null, pinky: null });
        if (!leftLandmarks)  setLeftHandFingers({ thumb: null, index: null, middle: null, ring: null, pinky: null });
        prevBothAggregate.current = { allOpen: false, allClosed: false };
      }
    } else {
      // 无手部数据时重置状态
      setRightHandFingers({ thumb: null, index: null, middle: null, ring: null, pinky: null });
      setLeftHandFingers({ thumb: null, index: null, middle: null, ring: null, pinky: null });
      prevBothAggregate.current = { allOpen: false, allClosed: false };
    }
    ctx.restore();
  }

  // 更新并判断手指状态
  function updateFingers(landmarks, handLabel) {
    const newStates = {};
    // 对每个手指计算状态
    Object.keys(FINGER_JOINTS).forEach(finger => {
      const [base, pip, tip] = FINGER_JOINTS[finger].map(i => landmarks[i]);
      if (finger === "thumb") {
        // 镜像翻转判断：右手时基点.x > 指尖.x 表示张开，左手时相反
        newStates[finger] = handLabel === "Right" ? base.x > tip.x : base.x < tip.x;
      } else {
        newStates[finger] = tip.y < pip.y && pip.y < base.y;
      }
    });

    const allOpen = Object.values(newStates).every(state => state === true);
    const allClosed = Object.values(newStates).every(state => state === false);

    // 根据手标识更新状态并发送MQTT消息（仅首次变化发送）
    if (handLabel === "Left") { // MediaPipe的Right标签实际为用户左手
      setLeftHandFingers(newStates);
      if (allOpen && !prevHandAggregate.current.left.allOpen) sendMessage("left-all", "Left-All-Open");
      if (allClosed && !prevHandAggregate.current.left.allClosed) sendMessage("left-all", "Left-All-Closed");
      setPrevThumbState(prev => ({ ...prev, left: newStates.thumb }));
      prevHandAggregate.current.left = { allOpen, allClosed };
    } else if (handLabel === "Right") { // MediaPipe的Left标签实际为用户右手
      setRightHandFingers(newStates);
      if (allOpen && !prevHandAggregate.current.right.allOpen) sendMessage("right-all", "Right-All-Open");
      if (allClosed && !prevHandAggregate.current.right.allClosed) sendMessage("right-all", "Right-All-Closed");
      setPrevThumbState(prev => ({ ...prev, right: newStates.thumb }));
      prevHandAggregate.current.right = { allOpen, allClosed };
    }
  }

  // 根据左右手状态综合判断播放或暂停视频
  useEffect(() => {
    const checkHands = (fingers) => Object.values(fingers).filter(v => v !== null);
    const left = checkHands(leftHandFingers);
    const right = checkHands(rightHandFingers);
    if (left.length >= 3 && right.length >= 3) {
      const leftOpen = left.every(v => v === true);
      const rightOpen = right.every(v => v === true);
      const leftClosed = left.every(v => v === false);
      const rightClosed = right.every(v => v === false);
      const bothOpen = leftOpen && rightOpen;
      const bothClosed = leftClosed && rightClosed;
      
      if (bothOpen && !prevBothAggregate.current.allOpen) {
        sendMessage("all", "Both-All-Open");
        prevBothAggregate.current.allOpen = true;
        videoPlaybackRef?.current?.paused && videoPlaybackRef.current.play().catch(err => console.log("播放失败:", err));
      } else if (!bothOpen) {
        prevBothAggregate.current.allOpen = false;
      }
      
      if (bothClosed && !prevBothAggregate.current.allClosed) {
        sendMessage("all", "Both-All-Closed");
        prevBothAggregate.current.allClosed = true;
        videoPlaybackRef?.current?.paused === false && videoPlaybackRef.current.pause();
      } else if (!bothClosed) {
        prevBothAggregate.current.allClosed = false;
      }
    } else {
      prevBothAggregate.current = { allOpen: false, allClosed: false };
    }
  }, [leftHandFingers, rightHandFingers, videoPlaybackRef]);

  return (
    <div>
      <div className="connection-status">
        <div className={`status-indicator ${mqttConnected ? "connected" : "disconnected"}`}>
          MQTT状态: {mqttConnected ? "已连接" : "未连接"}
        </div>
      </div>
      <div className="finger-visualization">
        {/* 左右手显示（UI顺序：左手在左，右手在右） */}
        <div className="hand left-hand">
          {Object.keys(leftHandFingers).map(f => (
            <div key={f} className={`finger ${leftHandFingers[f] === null ? "null" : leftHandFingers[f] ? "open" : "closed"}`} />
          ))}
        </div>
        <div className="hand right-hand">
          {Object.keys(rightHandFingers).map(f => (
            <div key={f} className={`finger ${rightHandFingers[f] === null ? "null" : rightHandFingers[f] ? "open" : "closed"}`} />
          ))}
        </div>
      </div>
      <video ref={videoRef} style={{ display: "none", transform: "scaleX(-1)" }} />
      <canvas ref={canvasRef} width={1280} height={720} style={{ transform: "scaleX(-1)" }} />
    </div>
  );
};

export default HandGestureRecognizer;