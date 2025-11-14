/**
 * @file 串口通信模块
 * @description 处理与手部关节传感器的串口通信，支持数据帧协议
 */

class SerialManager {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.isReading = false;
        this.dataCallback = null;
        this.errorCallback = null;
        this.responseCallback = null;
        this.portInfoCallback = null;
        this.packetCount = 0;
        this.lastUpdateTime = 0;
        this.updateRate = 0;
        
        // 数据缓冲区 - 用于处理分包数据
        this.readBuffer = new Uint8Array(0);
        this.maxBufferSize = 1024; // 最大缓冲区大小
        
        // 数据帧协议配置
        this.FRAME_HEADER = 0xAA;  // 单字节帧头
        this.FRAME_TAIL = 0x55;    // 单字节帧尾
        this.MIN_FRAME_LEN = 5;    // 最小帧长度：头1+类型1+长度1+校验1+尾1
        this.MAX_DATA_LENGTH = 255; // 最大数据长度
        
        // 串口配置 - 默认值
        this.serialConfig = {
            baudRate: 1152000,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none',
            timeout: 1000
        };
        
        // 端口信息
        this.portInfo = {
            name: '未连接',
            id: null,
            manufacturer: null,
            productId: null,
            vendorId: null
        };
        
        // 命令码定义（与Python代码保持一致）
        this.COMMANDS = {
            // 系统控制命令
            CMD_ENABLE: 0x01,
            CMD_DISABLE: 0x02,
            CMD_QUICK_START: 0x03,
            CMD_QUICK_FINISH: 0x04,
            CMD_ANCHOR_START: 0x05,
            CMD_RECORD: 0x06,
            CMD_APPLY: 0x07,
            CMD_SAVE: 0x08,
            CMD_LOAD: 0x09,
            CMD_CLEAR: 0x0A,
            CMD_STATUS: 0x0B,
            CMD_RESET: 0x0C,
            CMD_CAN_ENABLE: 0x0D,
            CMD_CAN_DISABLE: 0x0E,
            CMD_SENSOR_ENABLE: 0x0F,
            CMD_SENSOR_DISABLE: 0x10,
            CMD_MAPPING_ENABLE: 0x11,
            CMD_MAPPING_DISABLE: 0x12,
            CMD_SET_PROTOCOL: 0x13,
            
            // 数据通知类型
            CMD_SENSOR_DATA: 0x20,      // 传感器数据通知
            CMD_MAPPING_DATA: 0x21,      // 映射数据通知
            
            // 结果码
            RESULT_SUCCESS: 0x00,
            RESULT_FAIL: 0x01,
            RESULT_UNKNOWN_CMD: 0xFD,
            RESULT_NOT_ENABLED: 0xFE,
            RESULT_CHECKSUM_ERROR: 0xFF
        };
        
        // 关节名称列表（15个关节）
        this.JOINT_NAMES = [
            "Thumb-Yaw",
            "Thumb-Pitch",
            "Thumb-Tip",
            "Index-Yaw",
            "Index-Pitch",
            "Index-Tip",
            "Middle-Yaw",
            "Middle-Pitch",
            "Middle-Tip",
            "Ring-Yaw",
            "Ring-Pitch",
            "Ring-Tip",
            "Little-Yaw",
            "Little-Pitch",
            "Little-Tip"
        ];
        
    }

    /**
     * 设置数据接收回调函数
     * @param {Function} callback - 数据接收回调函数
     */
    setDataCallback(callback) {
        this.dataCallback = callback;
    }

    /**
     * 设置响应回调函数
     * @param {Function} callback - 响应回调函数
     */
    setResponseCallback(callback) {
        this.responseCallback = callback;
    }

    /**
     * 设置错误回调函数
     * @param {Function} callback - 错误回调函数
     */
    setErrorCallback(callback) {
        this.errorCallback = callback;
    }

    /**
     * 设置端口信息回调函数
     * @param {Function} callback - 端口信息回调函数
     */
    setPortInfoCallback(callback) {
        this.portInfoCallback = callback;
    }

    /**
     * 连接串口设备
     * @returns {Promise<boolean>} 连接是否成功
     */
    async connect() {
        try {
            // 检查浏览器是否支持Web Serial API
            if (!('serial' in navigator)) {
                throw new Error('浏览器不支持Web Serial API，请使用Chrome、Edge或Opera浏览器');
            }

            // 请求用户选择串口
            this.port = await navigator.serial.requestPort();
            
            // 获取端口信息
            this.updatePortInfo();
            
            // 打开串口连接，使用当前配置
            await this.port.open({
                baudRate: this.serialConfig.baudRate,
                dataBits: this.serialConfig.dataBits,
                stopBits: this.serialConfig.stopBits,
                parity: this.serialConfig.parity,
                flowControl: this.serialConfig.flowControl
            });

            // 获取读写器
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();

            // 清空缓冲区
            this.readBuffer = new Uint8Array(0);
            
            this.isConnected = true;
            this.lastUpdateTime = Date.now();
            
            console.log('串口连接成功', this.serialConfig);
            console.log('端口信息:', this.portInfo);
            
            // 通知端口信息更新
            if (this.portInfoCallback) {
                this.portInfoCallback(this.portInfo);
            }
            
            // 连接成功后自动发送启用数据帧模式命令
            try {
                await this.enable();
            } catch (error) {
                console.warn('自动启用数据帧模式失败:', error);
                // 即使启用失败，也不影响连接状态
            }
            
            return true;

        } catch (error) {
            console.error('串口连接失败:', error);
            this.isConnected = false;
            
            // 如果用户取消了端口选择，不触发错误回调
            if (error.name !== 'NotFoundError' && error.name !== 'AbortError') {
                if (this.errorCallback) {
                    this.errorCallback(error);
                }
            } else {
                console.log('用户取消了端口选择');
            }
            
            return false;
        }
    }

    /**
     * 断开串口连接
     */
    async disconnect() {
        try {
            this.isConnected = false;
            this.isReading = false;
            
            // 停止读取循环
            if (this.reader) {
                try {
                    await this.reader.cancel();
                    await this.reader.releaseLock();
                } catch (error) {
                    console.warn('释放读取器时出错:', error);
                }
                this.reader = null;
            }
            
            // 关闭写入器
            if (this.writer) {
                try {
                    await this.writer.close();
                    await this.writer.releaseLock();
                } catch (error) {
                    console.warn('释放写入器时出错:', error);
                }
                this.writer = null;
            }
            
            // 关闭端口
            if (this.port) {
                try {
                    await this.port.close();
                } catch (error) {
                    console.warn('关闭端口时出错:', error);
                }
                this.port = null;
            }
            
            // 清空缓冲区
            this.readBuffer = new Uint8Array(0);
            
            // 重置端口信息
            this.resetPortInfo();
            
            console.log('串口连接已断开');
            
            // 通知端口信息更新
            if (this.portInfoCallback) {
                this.portInfoCallback(this.portInfo);
            }
        } catch (error) {
            console.error('断开串口连接时出错:', error);
        }
    }

    /**
     * 计算校验和（补码累加和）
     * @param {number} cmdType - 命令类型
     * @param {number} dataLen - 数据长度
     * @param {Array} data - 数据数组（可选）
     * @returns {number} 校验和（0-255）
     */
    calculateChecksum(cmdType, dataLen, data = []) {
        let sumVal = cmdType + dataLen;
        if (data && data.length > 0) {
            sumVal += data.reduce((sum, byte) => sum + byte, 0);
        }
        // 补码累加和：(~sum + 1) & 0xFF
        return ((~sumVal + 1) & 0xFF);
    }

    /**
     * 发送数据帧
     * @param {number} cmdType - 命令类型
     * @param {Array} data - 数据数组（可选）
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendFrame(cmdType, data = []) {
        try {
            if (!this.isConnected || !this.writer) {
                throw new Error('串口未连接');
            }

            const dataLen = data.length;
            if (dataLen > this.MAX_DATA_LENGTH) {
                throw new Error(`数据长度超过最大限制: ${dataLen} > ${this.MAX_DATA_LENGTH}`);
            }

            // 构建数据帧：帧头(1) + 命令类型(1) + 数据长度(1) + 数据(N) + 校验和(1) + 帧尾(1)
            const frame = [];
            
            // 帧头
            frame.push(this.FRAME_HEADER);
            
            // 命令类型
            frame.push(cmdType);
            
            // 数据长度
            frame.push(dataLen);
            
            // 数据内容
            if (dataLen > 0) {
                frame.push(...data);
            }
            
            // 计算校验和（补码累加和）
            const checksum = this.calculateChecksum(cmdType, dataLen, data);
            frame.push(checksum);
            
            // 帧尾
            frame.push(this.FRAME_TAIL);

            // 发送数据帧
            await this.writer.write(new Uint8Array(frame));
            
            console.log(`发送数据帧: CMD=0x${cmdType.toString(16).padStart(2, '0')}, 数据长度=${dataLen}, 帧=${frame.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
            return true;

        } catch (error) {
            console.error('发送数据帧失败:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
            return false;
        }
    }

    /**
     * 开始读取数据
     */
    async startReading() {
        if (!this.isConnected || !this.reader) {
            console.error('串口未连接，无法开始读取数据');
            return;
        }

        // 防止重复启动读取循环
        if (this.isReading) {
            console.warn('读取循环已在运行中');
            return;
        }

        this.isReading = true;
        console.log('开始读取串口数据...');
        
        // 使用独立的读取循环，避免阻塞
        this.readLoop().catch(error => {
            console.error('读取循环异常:', error);
            this.isReading = false;
            if (this.errorCallback) {
                this.errorCallback(error);
            }
            // 如果连接仍然有效，尝试重新启动读取
            if (this.isConnected) {
                console.log('尝试重新启动读取循环...');
                setTimeout(() => {
                    if (this.isConnected && !this.isReading) {
                        this.startReading();
                    }
                }, 1000);
            }
        });
    }

    /**
     * 读取循环
     */
    async readLoop() {
        while (this.isConnected && this.reader) {
            try {
                const { value, done } = await this.reader.read();
                
                if (done) {
                    console.log('串口读取流已结束');
                    this.isReading = false;
                    break;
                }
                
                if (value && value.length > 0) {
                    // 将新数据添加到缓冲区
                    this.appendToBuffer(value);
                    
                    // 处理缓冲区中的数据
                    this.processBuffer();
                }
            } catch (error) {
                // 检查是否是取消操作
                if (error.name === 'AbortError' || error.message.includes('cancel')) {
                    console.log('读取操作已取消');
                    this.isReading = false;
                    break;
                }
                
                // 其他错误，记录并继续尝试
                console.error('读取数据时出错:', error);
                
                // 如果连接仍然有效，等待后继续
                if (this.isConnected) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                } else {
                    this.isReading = false;
                    break;
                }
            }
        }
        
        this.isReading = false;
    }

    /**
     * 将数据追加到缓冲区
     * @param {Uint8Array} newData - 新接收的数据
     */
    appendToBuffer(newData) {
        // 检查缓冲区大小，防止无限增长
        if (this.readBuffer.length + newData.length > this.maxBufferSize) {
            console.warn('缓冲区溢出，清空缓冲区');
            this.readBuffer = new Uint8Array(0);
        }
        
        // 合并数据
        const merged = new Uint8Array(this.readBuffer.length + newData.length);
        merged.set(this.readBuffer);
        merged.set(newData, this.readBuffer.length);
        this.readBuffer = merged;
    }

    /**
     * 处理缓冲区中的数据
     */
    processBuffer() {
        while (this.readBuffer.length > 0) {
            const frameStart = this.findFrameStart();
            
            if (frameStart === -1) {
                // 没有找到帧头，清空缓冲区（可能是不完整的数据）
                if (this.readBuffer.length > this.maxBufferSize / 2) {
                    console.warn('缓冲区中未找到有效帧头，清空部分数据');
                    this.readBuffer = this.readBuffer.slice(-10); // 保留最后10字节，可能包含帧头的一部分
                }
                break;
            }
            
            // 移除帧头之前的数据
            if (frameStart > 0) {
                this.readBuffer = this.readBuffer.slice(frameStart);
            }
            
            // 尝试解析完整的数据帧
            const frameLength = this.tryParseFrame();
            
            if (frameLength > 0) {
                // 成功解析了一帧，移除已处理的数据
                this.readBuffer = this.readBuffer.slice(frameLength);
            } else {
                // 数据不完整，等待更多数据
                break;
            }
        }
    }

    /**
     * 查找帧头位置
     * @returns {number} 帧头位置，未找到返回-1
     */
    findFrameStart() {
        for (let i = 0; i < this.readBuffer.length; i++) {
            if (this.readBuffer[i] === this.FRAME_HEADER) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 尝试解析数据帧
     * @returns {number} 解析的帧长度，如果数据不完整返回0，如果帧错误返回1（跳过当前字节）
     */
    tryParseFrame() {
        // 最小帧长度：帧头(1) + 命令类型(1) + 数据长度(1) + 校验和(1) + 帧尾(1) = 5
        if (this.readBuffer.length < this.MIN_FRAME_LEN) {
            return 0;
        }
        
        // 检查帧头
        if (this.readBuffer[0] !== this.FRAME_HEADER) {
            return 0;
        }
        
        // 至少需要3个字节才能知道数据长度（头+类型+长度）
        if (this.readBuffer.length < 3) {
            return 0;
        }
        
        const cmdType = this.readBuffer[1];
        const dataLength = this.readBuffer[2];
        
        // 检查数据长度是否合理
        if (dataLength > this.MAX_DATA_LENGTH) {
            console.warn(`数据长度异常: ${dataLength}`);
            return 1; // 跳过帧头字节，继续查找下一帧
        }
        
        // 计算完整帧长度：帧头(1) + 命令类型(1) + 数据长度(1) + 数据(dataLength) + 校验和(1) + 帧尾(1)
        const totalFrameLength = 5 + dataLength;
        
        // 检查是否有足够的数据
        if (this.readBuffer.length < totalFrameLength) {
            return 0; // 数据不完整，等待更多数据
        }
        
        // 提取帧数据
        const frameData = Array.from(this.readBuffer.slice(3, 3 + dataLength));
        const checksum = this.readBuffer[3 + dataLength];
        const frameTail = this.readBuffer[3 + dataLength + 1];
        
        // 检查帧尾
        if (frameTail !== this.FRAME_TAIL) {
            console.warn(`帧尾不匹配: 收到0x${frameTail.toString(16).padStart(2, '0')}, 期望0x${this.FRAME_TAIL.toString(16).padStart(2, '0')}`);
            return 1; // 跳过帧头字节，继续查找
        }
        
        // 验证校验和（补码累加和）
        const calculatedChecksum = this.calculateChecksum(cmdType, dataLength, frameData);
        
        if (calculatedChecksum !== checksum) {
            console.warn(`校验和错误: 收到0x${checksum.toString(16).padStart(2, '0')}, 计算0x${calculatedChecksum.toString(16).padStart(2, '0')}`);
            return 1; // 跳过帧头字节，继续查找
        }
        
        // 校验通过，解析数据帧
        this.parseFrame(cmdType, frameData);
        
        return totalFrameLength;
    }


    /**
     * 解析数据帧
     * @param {number} cmdType - 命令类型
     * @param {Array} data - 数据内容
     */
    parseFrame(cmdType, data) {
        try {
            // 更新统计信息
            this.updateStatistics();

            // 处理传感器数据通知（0x20）
            if (cmdType === this.COMMANDS.CMD_SENSOR_DATA) {
                this.parseSensorDataFrame(data);
            }
            // 处理映射数据通知（0x21）
            else if (cmdType === this.COMMANDS.CMD_MAPPING_DATA) {
                this.parseMappingDataFrame(data);
            }
            // 处理命令响应（其他命令类型）
            else {
                // 响应格式：结果码(result) + 额外数据
                const result = data.length > 0 ? data[0] : this.COMMANDS.RESULT_FAIL;
                const extraData = data.length > 1 ? data.slice(1) : [];
                
                if (result === this.COMMANDS.RESULT_SUCCESS) {
                    console.log(`命令执行成功: CMD=0x${cmdType.toString(16).padStart(2, '0')}`);
                    if (this.responseCallback) {
                        this.responseCallback('ok', cmdType, extraData);
                    }
                } else {
                    const resultNames = {
                        [this.COMMANDS.RESULT_FAIL]: '执行失败',
                        [this.COMMANDS.RESULT_UNKNOWN_CMD]: '未知命令',
                        [this.COMMANDS.RESULT_NOT_ENABLED]: '未启用',
                        [this.COMMANDS.RESULT_CHECKSUM_ERROR]: '校验和错误'
                    };
                    const resultName = resultNames[result] || `错误码0x${result.toString(16).padStart(2, '0')}`;
                    console.log(`命令执行失败: CMD=0x${cmdType.toString(16).padStart(2, '0')}, ${resultName}`);
                    if (this.responseCallback) {
                        this.responseCallback('error', cmdType, extraData);
                    }
                }
            }

        } catch (error) {
            console.error('解析数据帧时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 解析传感器数据帧（命令类型0x20）
     * @param {Array} data - 传感器数据数组（31字节：手侧1字节 + 15个uint16，每个2字节）
     */
    parseSensorDataFrame(data) {
        try {
            if (data.length < 31) {
                console.warn(`传感器数据长度不足: ${data.length}, 期望31`);
                return;
            }

            // 解析手侧（0=右手, 1=左手）
            const hand = data[0];
            
            // 解析15个uint16值（小端序）
            const sensorData = [];
            for (let i = 0; i < 15; i++) {
                const idx = 1 + i * 2;
                // 小端序：低字节在前，高字节在后
                const value = data[idx] | (data[idx + 1] << 8);
                sensorData.push(value);
            }

            // 构建关节数据对象
            const jointData = {
                hand: hand, // 0=右手, 1=左手
                // 大拇指
                thumbYaw: sensorData[0],
                thumbPitch: sensorData[1],
                thumbTip: sensorData[2],
                
                // 食指
                indexYaw: sensorData[3],
                indexPitch: sensorData[4],
                indexTip: sensorData[5],
                
                // 中指
                middleYaw: sensorData[6],
                middlePitch: sensorData[7],
                middleTip: sensorData[8],
                
                // 无名指
                ringYaw: sensorData[9],
                ringPitch: sensorData[10],
                ringTip: sensorData[11],
                
                // 小指
                pinkyYaw: sensorData[12],
                pinkyPitch: sensorData[13],
                pinkyTip: sensorData[14],
                
                // 原始传感器数据
                sensorData: sensorData,
                
                // 元数据
                timestamp: Date.now(),
                packetNumber: this.packetCount++
            };

            // 调用数据回调函数
            if (this.dataCallback) {
                this.dataCallback(jointData);
            }

        } catch (error) {
            console.error('解析传感器数据帧时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 解析映射数据帧（命令类型0x21）
     * @param {Array} data - 映射数据数组（61字节：手侧1字节 + 15个float，每个4字节）
     */
    parseMappingDataFrame(data) {
        try {
            if (data.length < 61) {
                console.warn(`映射数据长度不足: ${data.length}, 期望61`);
                return;
            }

            // 解析手侧（0=右手, 1=左手）
            const hand = data[0];
            
            // 解析15个float值（IEEE 754单精度，小端序）
            const mappingData = [];
            for (let i = 0; i < 15; i++) {
                const idx = 1 + i * 4;
                // 提取4字节
                const bytes = new Uint8Array([
                    data[idx],
                    data[idx + 1],
                    data[idx + 2],
                    data[idx + 3]
                ]);
                
                // 使用DataView解析IEEE 754单精度浮点数（小端序）
                const view = new DataView(bytes.buffer);
                const value = view.getFloat32(0, true); // true表示小端序
                mappingData.push(value);
            }

            // 构建映射数据对象
            const mappingDataObj = {
                hand: hand, // 0=右手, 1=左手
                // 大拇指
                thumbYaw: mappingData[0],
                thumbPitch: mappingData[1],
                thumbTip: mappingData[2],
                
                // 食指
                indexYaw: mappingData[3],
                indexPitch: mappingData[4],
                indexTip: mappingData[5],
                
                // 中指
                middleYaw: mappingData[6],
                middlePitch: mappingData[7],
                middleTip: mappingData[8],
                
                // 无名指
                ringYaw: mappingData[9],
                ringPitch: mappingData[10],
                ringTip: mappingData[11],
                
                // 小指
                pinkyYaw: mappingData[12],
                pinkyPitch: mappingData[13],
                pinkyTip: mappingData[14],
                
                // 原始映射数据
                mappingData: mappingData,
                
                // 元数据
                timestamp: Date.now(),
                packetNumber: this.packetCount++
            };

            // 调用数据回调函数（如果有映射数据回调）
            if (this.dataCallback) {
                this.dataCallback(mappingDataObj);
            }

        } catch (error) {
            console.error('解析映射数据帧时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastUpdateTime;
        
        if (timeDiff > 0) {
            this.updateRate = Math.round(1000 / timeDiff);
        }
        
        this.lastUpdateTime = currentTime;
    }

    /**
     * 获取连接状态
     * @returns {boolean} 是否已连接
     */
    getConnectionStatus() {
        return this.isConnected;
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息对象
     */
    getStatistics() {
        return {
            packetCount: this.packetCount,
            updateRate: this.updateRate,
            lastUpdateTime: this.lastUpdateTime,
            isConnected: this.isConnected
        };
    }

    /**
     * 重置统计信息
     */
    resetStatistics() {
        this.packetCount = 0;
        this.updateRate = 0;
        this.lastUpdateTime = 0;
    }

    /**
     * 更新串口配置
     * @param {Object} config - 新的串口配置
     */
    updateSerialConfig(config) {
        this.serialConfig = { ...this.serialConfig, ...config };
        console.log('串口配置已更新:', this.serialConfig);
    }

    /**
     * 获取当前串口配置
     * @returns {Object} 当前串口配置
     */
    getSerialConfig() {
        return { ...this.serialConfig };
    }

    /**
     * 重置串口配置为默认值
     */
    resetSerialConfig() {
        this.serialConfig = {
            baudRate: 1152000,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none',
            timeout: 1000
        };
        console.log('串口配置已重置为默认值');
    }

    /**
     * 保存串口配置到本地存储
     */
    saveSerialConfig() {
        try {
            localStorage.setItem('serialConfig', JSON.stringify(this.serialConfig));
            console.log('串口配置已保存到本地存储');
            return true;
        } catch (error) {
            console.error('保存串口配置失败:', error);
            return false;
        }
    }

    /**
     * 从本地存储加载串口配置
     */
    loadSerialConfig() {
        try {
            const savedConfig = localStorage.getItem('serialConfig');
            if (savedConfig) {
                this.serialConfig = { ...this.serialConfig, ...JSON.parse(savedConfig) };
                console.log('串口配置已从本地存储加载:', this.serialConfig);
                return true;
            }
            return false;
        } catch (error) {
            console.error('加载串口配置失败:', error);
            return false;
        }
    }

    /**
     * 更新端口信息
     */
    updatePortInfo() {
        if (this.port) {
            try {
                // Web Serial API 使用 getInfo() 方法获取端口信息
                const info = this.port.getInfo();
                
                if (info && info.usbVendorId && info.usbProductId) {
                    const portId = `${info.usbVendorId}:${info.usbProductId}`;
                    this.portInfo = {
                        name: `USB设备 (${portId})`,
                        id: portId,
                        manufacturer: info.usbVendorId ? `0x${info.usbVendorId.toString(16).padStart(4, '0')}` : null,
                        productId: info.usbProductId ? `0x${info.usbProductId.toString(16).padStart(4, '0')}` : null,
                        vendorId: info.usbVendorId ? `0x${info.usbVendorId.toString(16).padStart(4, '0')}` : null
                    };
                } else {
                    // 如果没有 USB 信息，使用默认值
                    this.portInfo = {
                        name: '串口设备',
                        id: 'serial-port',
                        manufacturer: null,
                        productId: null,
                        vendorId: null
                    };
                }
            } catch (error) {
                console.warn('获取端口信息失败:', error);
                this.portInfo = {
                    name: '串口设备',
                    id: 'serial-port',
                    manufacturer: null,
                    productId: null,
                    vendorId: null
                };
            }
        }
    }

    /**
     * 重置端口信息
     */
    resetPortInfo() {
        this.portInfo = {
            name: '未连接',
            id: null,
            manufacturer: null,
            productId: null,
            vendorId: null
        };
    }

    /**
     * 获取端口信息
     * @returns {Object} 端口信息
     */
    getPortInfo() {
        return { ...this.portInfo };
    }

    // 系统控制命令
    /**
     * 启用数据帧模式（发送字符串命令 "frame_enable\n"）
     */
    async enable() {
        try {
            if (!this.isConnected || !this.writer) {
                throw new Error('串口未连接');
            }
            const commandStr = "frame_enable\n";
            await this.writer.write(new TextEncoder().encode(commandStr));
            console.log('已发送启用命令: frame_enable');
            return true;
        } catch (error) {
            console.error('发送启用命令失败:', error);
            return false;
        }
    }

    async disable() {
        return await this.sendFrame(this.COMMANDS.CMD_DISABLE);
    }

    // 快速校准命令
    async startQuickCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_QUICK_START);
    }

    async finishQuickCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_QUICK_FINISH);
    }

    // 锚定点校准命令
    /**
     * 开始锚定点标定
     * @param {number} hand - 手侧（0=右手, 1=左手）
     * @param {Array<number>} fingers - 手指列表（1=食指, 2=中指, 3=无名指, 4=小指）
     */
    async startAnchorCalibration(hand, fingers) {
        const data = [hand, fingers.length, ...fingers];
        return await this.sendFrame(this.COMMANDS.CMD_ANCHOR_START, data);
    }

    async recordAnchorPoint() {
        return await this.sendFrame(this.COMMANDS.CMD_RECORD);
    }

    async applyAnchorCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_APPLY);
    }

    async saveCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_SAVE);
    }

    async loadCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_LOAD);
    }

    async clearCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_CLEAR);
    }

    async resetCalibration() {
        return await this.sendFrame(this.COMMANDS.CMD_RESET);
    }

    // 查询命令
    async getStatus() {
        return await this.sendFrame(this.COMMANDS.CMD_STATUS);
    }

    // 控制命令
    async enableCAN() {
        return await this.sendFrame(this.COMMANDS.CMD_CAN_ENABLE);
    }

    async disableCAN() {
        return await this.sendFrame(this.COMMANDS.CMD_CAN_DISABLE);
    }

    async enableSensor() {
        return await this.sendFrame(this.COMMANDS.CMD_SENSOR_ENABLE);
    }

    async disableSensor() {
        return await this.sendFrame(this.COMMANDS.CMD_SENSOR_DISABLE);
    }

    async enableMapping() {
        return await this.sendFrame(this.COMMANDS.CMD_MAPPING_ENABLE);
    }

    async disableMapping() {
        return await this.sendFrame(this.COMMANDS.CMD_MAPPING_DISABLE);
    }

    /**
     * 设置协议
     * @param {number} protocolId - 协议ID（0=L20, 1=L10, 2=L21）
     * @returns {Promise<Object>} 响应结果
     */
    async setProtocol(protocolId) {
        if (protocolId < 0 || protocolId > 2) {
            throw new Error('协议ID无效，必须是0(L20)、1(L10)或2(L21)');
        }
        const data = [protocolId];
        return await this.sendFrame(this.COMMANDS.CMD_SET_PROTOCOL, data);
    }
}

// 导出SerialManager类
window.SerialManager = SerialManager;