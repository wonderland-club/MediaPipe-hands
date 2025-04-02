import React, { useRef, useEffect } from 'react';

/**
 * 视频播放器组件
 * 负责视频的播放和展示
 * @param {Object} props - 组件属性
 * @param {string} props.videoSrc - 视频源路径
 * @param {function} props.onVideoRefChange - 视频引用变化时的回调函数
 * @param {React.RefObject} props.videoRef - 外部传入的视频引用
 * @param {boolean} props.controls - 是否显示视频控制按钮
 */
const VideoPlayer = ({ videoSrc, onVideoRefChange, videoRef: externalVideoRef, controls = true }) => {
  // 如果外部没有提供videoRef，则使用内部创建的ref
  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;
  // 创建一个ref来引用视频容器
  const containerRef = useRef(null);

  // 处理用户交互后的音频播放
  useEffect(() => {
    // 当视频引用可用时，通知父组件
    if (videoRef.current && onVideoRefChange) {
      onVideoRefChange(videoRef);
    }

    // 初始化视频属性
    if (videoRef.current) {
      videoRef.current.volume = 1.0;
    }
  }, [videoRef, onVideoRefChange]);

  // 单独处理用户交互事件
  useEffect(() => {
    const handleUserInteraction = () => {
      if (videoRef.current) {
        // 设置音频状态，但不重新加载视频
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        
        // 尝试播放以激活音频（仅当视频已暂停时）
        if (videoRef.current.paused) {
          videoRef.current.play().catch(err => {
            console.log('自动播放失败，可能需要用户手动点击播放按钮:', err);
          });
        }
      }
    };

    // 处理视频容器点击，但排除视频元素本身
    const handleContainerClick = (e) => {
      // 只有当点击的不是视频元素本身时才处理
      if (e.target !== videoRef.current) {
        handleUserInteraction();
      }
    };
    
    // 键盘事件处理
    const handleKeyDown = (e) => {
      handleUserInteraction();
    };

    // 添加事件监听器
    const videoContainer = containerRef.current;
    if (videoContainer) {
      videoContainer.addEventListener('click', handleContainerClick);
    }
    document.addEventListener('keydown', handleKeyDown);

    // 清理事件监听器
    return () => {
      if (videoContainer) {
        videoContainer.removeEventListener('click', handleContainerClick);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [videoRef, containerRef]);

  return (
    <div className="video-player-container" ref={containerRef}>
      <video
        ref={videoRef}
        width="640"
        height="360"
        src={videoSrc}
        controls={controls}
        playsInline
        autoPlay={false}
        muted={false}
        preload="auto"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;