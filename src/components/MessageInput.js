import React, { useState } from 'react';
import { sendMessage } from '../utils/mqttClient';

/**
 * 消息输入组件
 * 负责消息的输入和发送
 */
const MessageInput = () => {
  const [message, setMessage] = useState(''); // 用于保存输入框中的消息

  // 处理输入框变化
  const handleInputChange = (e) => {
    setMessage(e.target.value); // 更新输入框中的值
  };

  // 处理发送按钮点击事件
  const handleSendMessage = () => {
    if (message.trim() !== '') {
      sendMessage('name', message); // 发送消息到 'name' 主题
      setMessage(''); // 清空输入框
    } else {
      console.log('输入框为空，无法发送消息');
    }
  };

  return (
    <div className="message-input-container">
      <input
        type="text"
        value={message}
        onChange={handleInputChange}
        placeholder="Enter your message"
        className="message-input"
      />
      <button onClick={handleSendMessage} className="send-button">
        Send Message
      </button>
    </div>
  );
};

export default MessageInput;