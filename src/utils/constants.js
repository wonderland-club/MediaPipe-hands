/**
 * 应用常量定义
 * 集中管理应用中使用的常量值
 */

// MQTT主题
export const MQTT_TOPICS = {
  LEFT_HAND: 'left-all',
  RIGHT_HAND: 'right-all',
  BOTH_HANDS: 'all',
  CUSTOM_MESSAGE: 'name'
};

// 手势类型
export const GESTURE_TYPES = {
  LEFT_ALL_OPEN: 'Left-All-Open',
  LEFT_ALL_CLOSED: 'Left-All-Closed',
  RIGHT_ALL_OPEN: 'Right-All-Open',
  RIGHT_ALL_CLOSED: 'Right-All-Closed',
  BOTH_ALL_OPEN: 'Both-All-Open',
  BOTH_ALL_CLOSED: 'Both-All-Closed'
};

// MediaPipe配置
export const MEDIAPIPE_CONFIG = {
  MAX_NUM_HANDS: 2,
  MODEL_COMPLEXITY: 1,
  MIN_DETECTION_CONFIDENCE: 0.5,
  MIN_TRACKING_CONFIDENCE: 0.5
};

// 手指关节索引
export const FINGER_JOINTS = {
  thumb: [1, 2, 4],
  index: [5, 6, 8],
  middle: [9, 10, 12],
  ring: [13, 14, 16],
  pinky: [17, 18, 20]
};

// 视频尺寸
export const VIDEO_DIMENSIONS = {
  WIDTH: 1280,
  HEIGHT: 720
};

// 绘图样式
export const DRAWING_STYLES = {
  CONNECTORS: {
    color: '#00FF00',
    lineWidth: 5
  },
  LANDMARKS: {
    color: '#FF0000',
    lineWidth: 2
  }
};