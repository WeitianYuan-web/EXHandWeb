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
        this.dataCallback = null;
        this.errorCallback = null;
        this.responseCallback = null;
        this.portInfoCallback = null;
        this.packetCount = 0;
        this.lastUpdateTime = 0;
        this.updateRate = 0;
        
        // 数据帧协议配置
        this.FRAME_HEADER = [0xAA, 0x55];
        this.FRAME_TAIL = [0x0D, 0x0A];
        this.MAX_DATA_LENGTH = 246;
        
        // 串口配置 - 默认值
        this.serialConfig = {
            baudRate: 115200,
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
        
        // 命令码定义
        this.COMMANDS = {
            // 系统命令
            PING: 0x01,
            GET_VERSION: 0x02,
            GET_STATUS: 0x03,
            
            // 5点校准命令
            CAL_5P_START: 0x10,
            CAL_5P_NEXT: 0x11,
            CAL_5P_RESET: 0x12,
            CAL_5P_GET_STATE: 0x13,
            
            // 快速校准命令
            CAL_QUICK_START: 0x20,
            CAL_QUICK_FINISH: 0x21,
            CAL_QUICK_RESET: 0x22,
            CAL_QUICK_GET_STATE: 0x23,
            
            // 锚定点校准命令
            CAL_ANCHOR_START: 0x30,
            CAL_ANCHOR_RECORD: 0x31,
            CAL_ANCHOR_APPLY: 0x32,
            CAL_ANCHOR_RESET: 0x33,
            CAL_ANCHOR_GET_STATE: 0x34,
            
            // 传感器数据命令
            SENSOR_PRINT_ON: 0x40,
            SENSOR_PRINT_OFF: 0x41,
            SENSOR_GET_DATA: 0x42,
            
            // 校准参数命令
            PARAM_GET: 0x50,
            PARAM_SET: 0x51,
            PARAM_SAVE: 0x52,
            PARAM_LOAD: 0x53,
            
            // 响应码
            RESPONSE_OK: 0xF0,
            RESPONSE_ERROR: 0xF1,
            RESPONSE_DATA: 0xF2
        };
        
        // 绑定方法
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.onDataReceived = this.onDataReceived.bind(this);
        this.onError = this.onError.bind(this);
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

            this.isConnected = true;
            this.lastUpdateTime = Date.now();
            
            console.log('串口连接成功', this.serialConfig);
            console.log('端口信息:', this.portInfo);
            
            // 通知端口信息更新
            if (this.portInfoCallback) {
                this.portInfoCallback(this.portInfo);
            }
            
            return true;

        } catch (error) {
            console.error('串口连接失败:', error);
            this.isConnected = false;
            if (this.errorCallback) {
                this.errorCallback(error);
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
            
            if (this.reader) {
                await this.reader.cancel();
                this.reader = null;
            }
            
            if (this.writer) {
                await this.writer.close();
                this.writer = null;
            }
            
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
            
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
     * 计算校验和
     * @param {Array} data - 数据数组
     * @returns {number} 校验和
     */
    calculateChecksum(data) {
        return data.reduce((sum, byte) => sum + byte, 0) & 0xFF;
    }

    /**
     * 发送数据帧
     * @param {number} cmd - 命令码
     * @param {Array} data - 数据数组
     * @returns {Promise<boolean>} 发送是否成功
     */
    async sendFrame(cmd, data = []) {
        try {
            if (!this.isConnected || !this.writer) {
                throw new Error('串口未连接');
            }

            if (data.length > this.MAX_DATA_LENGTH) {
                throw new Error(`数据长度超过最大限制: ${data.length} > ${this.MAX_DATA_LENGTH}`);
            }

            // 构建数据帧
            const frame = [];
            
            // 帧头
            frame.push(...this.FRAME_HEADER);
            
            // 命令码
            frame.push(cmd);
            
            // 数据长度
            frame.push(data.length);
            
            // 数据内容
            frame.push(...data);
            
            // 计算校验和
            const checksumData = [cmd, data.length, ...data];
            const checksum = this.calculateChecksum(checksumData);
            frame.push(checksum);
            
            // 帧尾
            frame.push(...this.FRAME_TAIL);

            // 发送数据帧
            await this.writer.write(new Uint8Array(frame));
            
            console.log(`发送数据帧: ${frame.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
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

        console.log('开始读取串口数据...');
        
        try {
            while (this.isConnected && this.reader) {
                const { value, done } = await this.reader.read();
                
                if (done) {
                    console.log('串口读取完成');
                    break;
                }
                
                if (value) {
                    this.processData(value);
                }
            }
        } catch (error) {
            console.error('读取串口数据时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 处理接收到的原始数据
     * @param {Uint8Array} data - 原始数据
     */
    processData(data) {
        try {
            // 将Uint8Array转换为数组进行处理
            const dataArray = Array.from(data);
            
            // 查找完整的数据帧
            for (let i = 0; i < dataArray.length; i++) {
                // 查找帧头
                if (dataArray[i] === this.FRAME_HEADER[0] && 
                    i + 1 < dataArray.length && 
                    dataArray[i + 1] === this.FRAME_HEADER[1]) {
                    
                    // 检查是否有足够的数据组成一个完整的数据帧
                    if (i + 5 < dataArray.length) { // 至少需要帧头+命令+长度+校验和+帧尾
                        const cmd = dataArray[i + 2];
                        const length = dataArray[i + 3];
                        
                        // 检查帧长度是否合理
                        if (length <= this.MAX_DATA_LENGTH && 
                            i + 5 + length < dataArray.length) {
                            
                            const frameData = dataArray.slice(i + 4, i + 4 + length);
                            const checksum = dataArray[i + 4 + length];
                            const tail = dataArray.slice(i + 5 + length, i + 7 + length);
                            
                            // 验证帧尾
                            if (tail.length === 2 && 
                                tail[0] === this.FRAME_TAIL[0] && 
                                tail[1] === this.FRAME_TAIL[1]) {
                                
                                // 验证校验和
                                const checksumData = [cmd, length, ...frameData];
                                const calculatedChecksum = this.calculateChecksum(checksumData);
                                
                                if (calculatedChecksum === checksum) {
                                    this.parseFrame(cmd, frameData);
                                    i += 6 + length; // 跳过已处理的数据
                                } else {
                                    console.warn('校验和错误:', calculatedChecksum, '!=', checksum);
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理数据时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 解析数据帧
     * @param {number} cmd - 命令码
     * @param {Array} data - 数据内容
     */
    parseFrame(cmd, data) {
        try {
            // 更新统计信息
            this.updateStatistics();

            // 处理响应帧
            if (cmd === this.COMMANDS.RESPONSE_OK) {
                const originalCmd = data[0];
                console.log(`命令执行成功: 0x${originalCmd.toString(16).padStart(2, '0')}`);
                if (this.responseCallback) {
                    this.responseCallback('ok', originalCmd, data.slice(1));
                }
            } else if (cmd === this.COMMANDS.RESPONSE_ERROR) {
                const originalCmd = data[0];
                console.log(`命令执行失败: 0x${originalCmd.toString(16).padStart(2, '0')}`);
                if (this.responseCallback) {
                    this.responseCallback('error', originalCmd, data.slice(1));
                }
            } else if (cmd === this.COMMANDS.RESPONSE_DATA) {
                const originalCmd = data[0];
                const responseData = data.slice(1);
                console.log(`数据响应: 0x${originalCmd.toString(16).padStart(2, '0')}`, responseData);
                if (this.responseCallback) {
                    this.responseCallback('data', originalCmd, responseData);
                }
                
                // 如果是传感器数据，也调用数据回调
                if (originalCmd === this.COMMANDS.SENSOR_GET_DATA && responseData.length === 15) {
                    this.parseSensorData(responseData);
                }
            } else {
                console.log(`未知命令: 0x${cmd.toString(16).padStart(2, '0')}`, data);
            }

        } catch (error) {
            console.error('解析数据帧时出错:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * 解析传感器数据
     * @param {Array} data - 传感器数据数组
     */
    parseSensorData(data) {
        try {
            // 解析15个关节角度数据
            const jointData = {
                // 大拇指
                thumbYaw: data[0],
                thumbPitch: data[1],
                thumbTip: data[2],
                
                // 食指
                indexYaw: data[3],
                indexPitch: data[4],
                indexTip: data[5],
                
                // 中指
                middleYaw: data[6],
                middlePitch: data[7],
                middleTip: data[8],
                
                // 无名指
                ringYaw: data[9],
                ringPitch: data[10],
                ringTip: data[11],
                
                // 小指
                pinkyYaw: data[12],
                pinkyPitch: data[13],
                pinkyTip: data[14],
                
                // 元数据
                timestamp: Date.now(),
                packetNumber: this.packetCount++
            };

            // 调用数据回调函数
            if (this.dataCallback) {
                this.dataCallback(jointData);
            }

        } catch (error) {
            console.error('解析传感器数据时出错:', error);
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
            baudRate: 115200,
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
            this.portInfo = {
                name: this.port.getInfo ? this.port.getInfo().usbVendorId + ':' + this.port.getInfo().usbProductId : '未知设备',
                id: this.port.getInfo ? this.port.getInfo().usbVendorId + ':' + this.port.getInfo().usbProductId : null,
                manufacturer: this.port.getInfo ? this.port.getInfo().usbVendorId : null,
                productId: this.port.getInfo ? this.port.getInfo().usbProductId : null,
                vendorId: this.port.getInfo ? this.port.getInfo().usbVendorId : null
            };
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

    // 系统命令
    async ping() {
        return await this.sendFrame(this.COMMANDS.PING);
    }

    async getVersion() {
        return await this.sendFrame(this.COMMANDS.GET_VERSION);
    }

    async getStatus() {
        return await this.sendFrame(this.COMMANDS.GET_STATUS);
    }

    // 5点校准命令
    async start5PointCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_5P_START);
    }

    async next5PointStep() {
        return await this.sendFrame(this.COMMANDS.CAL_5P_NEXT);
    }

    async reset5PointCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_5P_RESET);
    }

    async get5PointCalibrationState() {
        return await this.sendFrame(this.COMMANDS.CAL_5P_GET_STATE);
    }

    // 快速校准命令
    async startQuickCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_QUICK_START);
    }

    async finishQuickCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_QUICK_FINISH);
    }

    async resetQuickCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_QUICK_RESET);
    }

    async getQuickCalibrationState() {
        return await this.sendFrame(this.COMMANDS.CAL_QUICK_GET_STATE);
    }

    // 锚定点校准命令
    async startAnchorCalibration(finger1, finger2) {
        return await this.sendFrame(this.COMMANDS.CAL_ANCHOR_START, [finger1, finger2]);
    }

    async recordAnchorPoint() {
        return await this.sendFrame(this.COMMANDS.CAL_ANCHOR_RECORD);
    }

    async applyAnchorCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_ANCHOR_APPLY);
    }

    async resetAnchorCalibration() {
        return await this.sendFrame(this.COMMANDS.CAL_ANCHOR_RESET);
    }

    async getAnchorCalibrationState() {
        return await this.sendFrame(this.COMMANDS.CAL_ANCHOR_GET_STATE);
    }

    // 传感器数据命令
    async enableSensorPrint() {
        return await this.sendFrame(this.COMMANDS.SENSOR_PRINT_ON);
    }

    async disableSensorPrint() {
        return await this.sendFrame(this.COMMANDS.SENSOR_PRINT_OFF);
    }

    async getSensorData() {
        return await this.sendFrame(this.COMMANDS.SENSOR_GET_DATA);
    }

    // 校准参数命令
    async getCalibrationParameter(sensorIdx) {
        return await this.sendFrame(this.COMMANDS.PARAM_GET, [sensorIdx]);
    }

    async setCalibrationParameter(sensorIdx, minHigh, minLow, maxHigh, maxLow) {
        return await this.sendFrame(this.COMMANDS.PARAM_SET, [sensorIdx, minHigh, minLow, maxHigh, maxLow]);
    }

    async saveCalibrationParameters() {
        return await this.sendFrame(this.COMMANDS.PARAM_SAVE);
    }

    async loadCalibrationParameters() {
        return await this.sendFrame(this.COMMANDS.PARAM_LOAD);
    }
}

// 导出SerialManager类
window.SerialManager = SerialManager;