/**
 * @file 主应用程序
 * @description 整合串口通信、3D模型和UI显示功能
 */

class HandSensorApp {
    constructor() {
        this.serialManager = null;
        this.isInitialized = false;
        this.updateInterval = null;
        this.isAnimationEnabled = false;
        
        // UI元素引用
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            connectionText: document.getElementById('connection-text'),
            connectBtn: document.getElementById('connect-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            resetValuesBtn: document.getElementById('reset-values'),
            toggleAnimationBtn: document.getElementById('toggle-animation'),
            packetCount: document.getElementById('packet-count'),
            updateRate: document.getElementById('update-rate'),
            lastUpdate: document.getElementById('last-update'),
            
            // 系统命令
            statusBtn: document.getElementById('status-btn'),
            systemResponse: document.getElementById('system-response'),
            
            // 串口配置
            baudRate: document.getElementById('baud-rate'),
            dataBits: document.getElementById('data-bits'),
            stopBits: document.getElementById('stop-bits'),
            parity: document.getElementById('parity'),
            flowControl: document.getElementById('flow-control'),
            timeout: document.getElementById('timeout'),
            saveConfig: document.getElementById('save-config'),
            loadConfig: document.getElementById('load-config'),
            resetConfig: document.getElementById('reset-config'),
            refreshPorts: document.getElementById('refresh-ports'),
            
            // 端口信息
            currentPort: document.getElementById('current-port'),
            portDetails: document.getElementById('port-details'),
            portId: document.getElementById('port-id'),
            portManufacturer: document.getElementById('port-manufacturer'),
            portProductId: document.getElementById('port-product-id'),
            portVendorId: document.getElementById('port-vendor-id')
        };
        
        // 关节进度条元素
        this.jointElements = this.initializeJointElements();
        
        // 日志窗口元素
        this.logContainer = null;
        this.logMaxLines = 500; // 最大日志行数
        
        this.init();
    }

    /**
     * 初始化应用程序
     */
    async init() {
        try {
            console.log('初始化手部关节传感器应用程序...');
            
            // 初始化串口管理器
            this.serialManager = new SerialManager();
            
            // 初始化日志窗口
            this.initLogWindow();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 设置串口回调
            this.setupSerialCallbacks();
            
            // 加载串口配置（在串口管理器完全初始化后）
            this.loadSerialConfig();
            
            this.isInitialized = true;
            this.log('应用程序初始化完成', 'info');
            
        } catch (error) {
            console.error('初始化应用程序失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化关节元素引用
     * @returns {Object} 关节元素对象
     */
    initializeJointElements() {
        const joints = {};
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        const jointTypes = ['yaw', 'pitch', 'tip'];
        
        fingerNames.forEach(fingerName => {
            joints[fingerName] = {};
            jointTypes.forEach(jointType => {
                const barElement = document.getElementById(`${fingerName}-${jointType}-bar`);
                const valueElement = document.getElementById(`${fingerName}-${jointType}-value`);
                
                if (barElement && valueElement) {
                    joints[fingerName][jointType] = {
                        bar: barElement,
                        value: valueElement
                    };
                }
            });
        });
        
        return joints;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        try {
            // 连接按钮
            if (this.elements.connectBtn) {
                this.elements.connectBtn.addEventListener('click', () => this.connectSerial());
            }
            
            // 断开连接按钮
            if (this.elements.disconnectBtn) {
                this.elements.disconnectBtn.addEventListener('click', () => this.disconnectSerial());
            }
            
            // 重置数值按钮
            if (this.elements.resetValuesBtn) {
                this.elements.resetValuesBtn.addEventListener('click', () => this.resetValues());
            }
            
            // 切换动画模式按钮
            if (this.elements.toggleAnimationBtn) {
                this.elements.toggleAnimationBtn.addEventListener('click', () => this.toggleAnimation());
            }
            
            // 系统命令按钮
            const statusBtn = document.getElementById('status-btn');
            if (statusBtn) {
                statusBtn.addEventListener('click', () => this.getStatus());
            }
            
            // 快速校准按钮
            const quickStartBtn = document.getElementById('quick-start-btn');
            if (quickStartBtn) {
                quickStartBtn.addEventListener('click', () => this.startQuickCalibration());
            }
            const quickFinishBtn = document.getElementById('quick-finish-btn');
            if (quickFinishBtn) {
                quickFinishBtn.addEventListener('click', () => this.finishQuickCalibration());
            }
            
            // 锚定点校准按钮
            const anchorStartBtn = document.getElementById('anchor-start-btn');
            if (anchorStartBtn) {
                anchorStartBtn.addEventListener('click', () => this.startAnchorCalibration());
            }
            const anchorRecordBtn = document.getElementById('anchor-record-btn');
            if (anchorRecordBtn) {
                anchorRecordBtn.addEventListener('click', () => this.recordAnchorPoint());
            }
            const anchorApplyBtn = document.getElementById('anchor-apply-btn');
            if (anchorApplyBtn) {
                anchorApplyBtn.addEventListener('click', () => this.applyAnchorCalibration());
            }
            
            // 校准数据管理按钮
            const saveCalibrationBtn = document.getElementById('save-calibration-btn');
            if (saveCalibrationBtn) {
                saveCalibrationBtn.addEventListener('click', () => this.saveCalibration());
            }
            const loadCalibrationBtn = document.getElementById('load-calibration-btn');
            if (loadCalibrationBtn) {
                loadCalibrationBtn.addEventListener('click', () => this.loadCalibration());
            }
            const clearCalibrationBtn = document.getElementById('clear-calibration-btn');
            if (clearCalibrationBtn) {
                clearCalibrationBtn.addEventListener('click', () => this.clearCalibration());
            }
            const resetCalibrationBtn = document.getElementById('reset-calibration-btn');
            if (resetCalibrationBtn) {
                resetCalibrationBtn.addEventListener('click', () => this.resetCalibration());
            }
            
            // CAN控制按钮
            const canEnableBtn = document.getElementById('can-enable-btn');
            if (canEnableBtn) {
                canEnableBtn.addEventListener('click', () => this.enableCAN());
            }
            const canDisableBtn = document.getElementById('can-disable-btn');
            if (canDisableBtn) {
                canDisableBtn.addEventListener('click', () => this.disableCAN());
            }
            
            // 传感器控制按钮
            const sensorEnableBtn = document.getElementById('sensor-enable-btn');
            if (sensorEnableBtn) {
                sensorEnableBtn.addEventListener('click', () => this.enableSensor());
            }
            const sensorDisableBtn = document.getElementById('sensor-disable-btn');
            if (sensorDisableBtn) {
                sensorDisableBtn.addEventListener('click', () => this.disableSensor());
            }
            
            // 映射数据控制按钮
            const mappingEnableBtn = document.getElementById('mapping-enable-btn');
            if (mappingEnableBtn) {
                mappingEnableBtn.addEventListener('click', () => this.enableMapping());
            }
            const mappingDisableBtn = document.getElementById('mapping-disable-btn');
            if (mappingDisableBtn) {
                mappingDisableBtn.addEventListener('click', () => this.disableMapping());
            }
            
            // 清空日志按钮
            const clearLogBtn = document.getElementById('clear-log-btn');
            if (clearLogBtn) {
                clearLogBtn.addEventListener('click', () => this.clearLog());
            }
            
            // 串口配置按钮
            if (this.elements.saveConfig) {
                this.elements.saveConfig.addEventListener('click', () => this.saveSerialConfig());
            }
            if (this.elements.loadConfig) {
                this.elements.loadConfig.addEventListener('click', () => this.loadSerialConfig());
            }
            if (this.elements.resetConfig) {
                this.elements.resetConfig.addEventListener('click', () => this.resetSerialConfig());
            }
            if (this.elements.refreshPorts) {
                this.elements.refreshPorts.addEventListener('click', () => this.refreshSerialPorts());
            }
            
            // 串口配置变化监听
            if (this.elements.baudRate) {
                this.elements.baudRate.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            if (this.elements.dataBits) {
                this.elements.dataBits.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            if (this.elements.stopBits) {
                this.elements.stopBits.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            if (this.elements.parity) {
                this.elements.parity.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            if (this.elements.flowControl) {
                this.elements.flowControl.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            if (this.elements.timeout) {
                this.elements.timeout.addEventListener('change', () => this.updateSerialConfigFromUI());
            }
            
            // 键盘快捷键
            document.addEventListener('keydown', (event) => this.handleKeyboard(event));
            
        } catch (error) {
            console.error('设置事件监听器失败:', error);
        }
    }

    /**
     * 设置串口回调函数
     */
    setupSerialCallbacks() {
        try {
            if (!this.serialManager) {
                console.warn('串口管理器未初始化，跳过回调设置');
                return;
            }
            
            // 数据接收回调
            this.serialManager.setDataCallback((jointData) => {
                this.updateJointDisplay(jointData);
                this.updateStatistics();
                // 记录数据接收日志（降低频率，每10个数据包记录一次）
                if (jointData.packetNumber % 10 === 0) {
                    this.log(`收到${jointData.hand === 0 ? '右手' : '左手'}数据包 #${jointData.packetNumber}`, 'info');
                }
            });
            
            // 响应回调
            this.serialManager.setResponseCallback((type, cmd, data) => {
                this.handleResponse(type, cmd, data);
            });
            
            // 错误回调
            this.serialManager.setErrorCallback((error) => {
                const errorMsg = '串口错误: ' + error.message;
                this.log(errorMsg, 'error');
                this.showError(errorMsg);
                this.updateConnectionStatus(false);
            });
            
            // 端口信息回调
            this.serialManager.setPortInfoCallback((portInfo) => {
                this.updatePortInfo(portInfo);
            });
        } catch (error) {
            console.error('设置串口回调失败:', error);
        }
    }

    /**
     * 连接串口
     */
    async connectSerial() {
        try {
            this.log('正在连接串口...', 'info');
            
            const success = await this.serialManager.connect();
            
            if (success) {
                this.updateConnectionStatus(true);
                this.log('串口连接成功', 'success');
                this.showSuccess('串口连接成功');
                
                // 开始读取数据
                this.serialManager.startReading();
                this.log('开始读取串口数据', 'info');
                
            } else {
                this.updateConnectionStatus(false);
                this.log('串口连接失败', 'error');
                this.showError('串口连接失败');
            }
            
        } catch (error) {
            const errorMsg = '连接串口失败: ' + error.message;
            this.log(errorMsg, 'error');
            this.updateConnectionStatus(false);
            this.showError(errorMsg);
        }
    }

    /**
     * 断开串口连接
     */
    async disconnectSerial() {
        try {
            this.log('正在断开串口连接...', 'info');
            await this.serialManager.disconnect();
            this.updateConnectionStatus(false);
            this.log('串口连接已断开', 'info');
            this.showSuccess('串口连接已断开');
            
        } catch (error) {
            const errorMsg = '断开连接失败: ' + error.message;
            this.log(errorMsg, 'error');
            this.showError(errorMsg);
        }
    }

    /**
     * 更新连接状态显示
     * @param {boolean} isConnected - 是否已连接
     */
    updateConnectionStatus(isConnected) {
        if (isConnected) {
            this.elements.connectionStatus.className = 'status-dot connected';
            this.elements.connectionText.textContent = '已连接';
            this.elements.connectBtn.disabled = true;
            this.elements.disconnectBtn.disabled = false;
            
            // 启用所有命令按钮
            this.enableAllButtons(true);
        } else {
            this.elements.connectionStatus.className = 'status-dot disconnected';
            this.elements.connectionText.textContent = '未连接';
            this.elements.connectBtn.disabled = false;
            this.elements.disconnectBtn.disabled = true;
            
            // 禁用所有命令按钮
            this.enableAllButtons(false);
        }
    }

    /**
     * 启用或禁用所有命令按钮
     * @param {boolean} enabled - 是否启用
     */
    enableAllButtons(enabled) {
        const commandButtonIds = [
            'status-btn',
            'quick-start-btn', 'quick-finish-btn',
            'anchor-start-btn', 'anchor-record-btn', 'anchor-apply-btn',
            'save-calibration-btn', 'load-calibration-btn', 'clear-calibration-btn', 'reset-calibration-btn',
            'can-enable-btn', 'can-disable-btn',
            'sensor-enable-btn', 'sensor-disable-btn',
            'mapping-enable-btn', 'mapping-disable-btn'
        ];
        
        commandButtonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = !enabled;
        });
    }

    /**
     * 更新关节数据显示（使用映射数据0-1.0）
     * @param {Object} jointData - 关节数据对象
     */
    updateJointDisplay(jointData) {
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        const jointTypes = ['yaw', 'pitch', 'tip'];
        
        // 检查是否有映射数据（mappingData字段）
        const useMappingData = jointData.mappingData && Array.isArray(jointData.mappingData);
        
        fingerNames.forEach(fingerName => {
            jointTypes.forEach(jointType => {
                const dataKey = `${fingerName}${jointType.charAt(0).toUpperCase() + jointType.slice(1)}`;
                let value;
                
                if (useMappingData) {
                    // 使用映射数据（0-1.0范围）
                    const index = fingerNames.indexOf(fingerName) * 3 + jointTypes.indexOf(jointType);
                    value = jointData.mappingData[index];
                } else {
                    // 如果没有映射数据，尝试使用原始数据（兼容性）
                    value = jointData[dataKey];
                    if (value !== undefined && value > 1.0) {
                        // 如果是角度值，转换为0-1.0范围（假设最大255）
                        value = value / 255.0;
                    }
                }
                
                if (this.jointElements[fingerName] && this.jointElements[fingerName][jointType] && value !== undefined) {
                    const elements = this.jointElements[fingerName][jointType];
                    
                    // 确保值在0-1.0范围内
                    value = Math.max(0, Math.min(1.0, value));
                    
                    // 更新数值显示（显示为百分比或小数）
                    elements.value.textContent = value.toFixed(3);
                    
                    // 更新进度条（0-1.0映射到0-100%）
                    const percentage = value * 100;
                    elements.bar.style.width = `${percentage}%`;
                    
                    // 添加动画效果
                    if (this.isAnimationEnabled) {
                        elements.bar.classList.add('joint-active');
                        setTimeout(() => {
                            elements.bar.classList.remove('joint-active');
                        }, 1000);
                    }
                }
            });
        });
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = this.serialManager.getStatistics();
        
        this.elements.packetCount.textContent = stats.packetCount;
        this.elements.updateRate.textContent = `${stats.updateRate} Hz`;
        
        if (stats.lastUpdateTime > 0) {
            const lastUpdate = new Date(stats.lastUpdateTime);
            this.elements.lastUpdate.textContent = lastUpdate.toLocaleTimeString();
        }
    }

    /**
     * 重置关节数值
     */
    resetValues() {
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        const jointTypes = ['yaw', 'pitch', 'tip'];
        
        fingerNames.forEach(fingerName => {
            jointTypes.forEach(jointType => {
                if (this.jointElements[fingerName] && this.jointElements[fingerName][jointType]) {
                    const elements = this.jointElements[fingerName][jointType];
                    
                    // 重置数值显示（显示为0.000）
                    elements.value.textContent = '0.000';
                    
                    // 重置进度条
                    elements.bar.style.width = '0%';
                }
            });
        });
        
        this.log('关节数值已重置', 'info');
    }

    /**
     * 切换动画模式
     */
    toggleAnimation() {
        this.isAnimationEnabled = !this.isAnimationEnabled;
        
        // 更新按钮文本
        const btn = this.elements.toggleAnimationBtn;
        btn.textContent = this.isAnimationEnabled ? '关闭动画' : '动画模式';
        
        console.log('动画模式:', this.isAnimationEnabled ? '开启' : '关闭');
    }

    /**
     * 处理串口响应
     * @param {string} type - 响应类型 (ok, error, data)
     * @param {number} cmd - 命令码
     * @param {Array} data - 响应数据
     */
    handleResponse(type, cmd, data) {
        const cmdName = this.getCommandName(cmd);
        const timestamp = new Date().toLocaleTimeString();
        
        let responseText = `[${timestamp}] 命令: ${cmdName} (0x${cmd.toString(16).padStart(2, '0')})\n`;
        let logMessage = '';
        
        if (type === 'ok') {
            responseText += `状态: 执行成功\n`;
            logMessage = `命令执行成功: ${cmdName} (0x${cmd.toString(16).padStart(2, '0')})`;
            this.log(logMessage, 'success');
            this.showResponse(this.elements.systemResponse, responseText, 'success');
        } else if (type === 'error') {
            responseText += `状态: 执行失败\n`;
            logMessage = `命令执行失败: ${cmdName} (0x${cmd.toString(16).padStart(2, '0')})`;
            this.log(logMessage, 'error');
            this.showResponse(this.elements.systemResponse, responseText, 'error');
        } else if (type === 'data') {
            responseText += `数据: ${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
            logMessage = `收到数据响应: ${cmdName} (0x${cmd.toString(16).padStart(2, '0')}), 数据长度=${data.length}`;
            this.log(logMessage, 'info');
            this.showResponse(this.elements.systemResponse, responseText, 'data');
            
            // 特殊处理某些命令的响应
            if (cmd === this.serialManager.COMMANDS.CMD_STATUS && data.length >= 6) {
                const statusInfo = `快速校准状态=${data[0]}, 锚定点状态=${data[1]}, 数据帧模式=${data[2]}, 传感器打印=${data[3]}, CAN控制=${data[4]}, 传感器发送=${data[5]}`;
                this.log(statusInfo, 'info');
            }
        }
    }

    /**
     * 显示响应信息
     * @param {HTMLElement} element - 显示元素
     * @param {string} text - 响应文本
     * @param {string} type - 响应类型
     */
    showResponse(element, text, type) {
        if (element) {
            element.textContent = text;
            element.className = `response-display ${type}`;
        }
    }

    /**
     * 获取命令名称
     * @param {number} cmd - 命令码
     * @returns {string} 命令名称
     */
    getCommandName(cmd) {
        const commandNames = {
            0x01: '启用数据帧模式',
            0x02: '禁用数据帧模式',
            0x03: '开始快速校准',
            0x04: '完成快速校准',
            0x05: '开始锚定点校准',
            0x06: '记录锚定点',
            0x07: '应用锚定点',
            0x08: '保存校准数据',
            0x09: '加载校准数据',
            0x0A: '清除校准数据',
            0x0B: '查询状态',
            0x0C: '重置校准',
            0x0D: '启用CAN控制',
            0x0E: '禁用CAN控制',
            0x0F: '启用传感器数据推送',
            0x10: '禁用传感器数据推送',
            0x11: '启用映射数据推送',
            0x12: '禁用映射数据推送',
            0x20: '传感器数据通知',
            0x21: '映射数据通知'
        };
        
        return commandNames[cmd] || `未知命令 (0x${cmd.toString(16).padStart(2, '0')})`;
    }

    /**
     * 切换校准标签页
     * @param {string} tabName - 标签页名称
     */
    switchCalibrationTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // 更新标签内容显示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} event - 键盘事件
     */
    handleKeyboard(event) {
        switch (event.key) {
            case 'r':
            case 'R':
                this.resetValues();
                break;
            case 'a':
            case 'A':
                this.toggleAnimation();
                break;
            case 'c':
            case 'C':
                if (this.serialManager.getConnectionStatus()) {
                    this.disconnectSerial();
                } else {
                    this.connectSerial();
                }
                break;
        }
    }

    /**
     * 初始化日志窗口
     */
    initLogWindow() {
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            this.logContainer = logContainer;
        }
    }

    /**
     * 添加日志
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型 (info, success, error, warning)
     */
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-message">${message}</span>`;
        
        if (this.logContainer) {
            this.logContainer.appendChild(logEntry);
            
            // 限制日志行数
            const logEntries = this.logContainer.querySelectorAll('.log-entry');
            if (logEntries.length > this.logMaxLines) {
                logEntries[0].remove();
            }
            
            // 自动滚动到底部
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
        
        // 同时输出到控制台
        const consoleMethods = {
            'info': console.log,
            'success': console.log,
            'error': console.error,
            'warning': console.warn
        };
        const consoleMethod = consoleMethods[type] || console.log;
        consoleMethod(`[${timestamp}] ${message}`);
    }

    /**
     * 清空日志
     */
    clearLog() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '';
        }
    }

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message) {
        this.log(message, 'info');
    }

    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        this.log(message, 'success');
        this.showNotification(message, 'success');
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        this.log(message, 'error');
        this.showNotification(message, 'error');
    }

    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, info)
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;
        
        // 设置背景颜色
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
        }
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 系统命令方法
    async getStatus() {
        this.log('发送查询状态命令', 'info');
        await this.serialManager.getStatus();
    }

    // 快速校准方法
    async startQuickCalibration() {
        this.log('发送快速校准开始命令', 'info');
        await this.serialManager.startQuickCalibration();
    }

    async finishQuickCalibration() {
        this.log('发送快速校准完成命令', 'info');
        await this.serialManager.finishQuickCalibration();
    }

    // 锚定点校准方法
    async startAnchorCalibration() {
        const hand = parseInt(document.getElementById('anchor-hand')?.value || 0);
        const finger1 = parseInt(document.getElementById('anchor-finger1')?.value || 1);
        const finger2 = parseInt(document.getElementById('anchor-finger2')?.value || 2);
        this.log(`发送锚定点校准开始命令: 手侧=${hand}, 手指=[${finger1}, ${finger2}]`, 'info');
        await this.serialManager.startAnchorCalibration(hand, [finger1, finger2]);
    }

    async recordAnchorPoint() {
        this.log('发送记录锚定点命令', 'info');
        await this.serialManager.recordAnchorPoint();
    }

    async applyAnchorCalibration() {
        this.log('发送应用锚定点校准命令', 'info');
        await this.serialManager.applyAnchorCalibration();
    }

    // 校准数据管理方法
    async saveCalibration() {
        this.log('发送保存校准数据命令', 'info');
        await this.serialManager.saveCalibration();
    }

    async loadCalibration() {
        this.log('发送加载校准数据命令', 'info');
        await this.serialManager.loadCalibration();
    }

    async clearCalibration() {
        this.log('发送清除校准数据命令', 'info');
        await this.serialManager.clearCalibration();
    }

    async resetCalibration() {
        this.log('发送重置校准命令', 'info');
        await this.serialManager.resetCalibration();
    }

    // CAN控制方法
    async enableCAN() {
        this.log('发送启用CAN控制命令', 'info');
        await this.serialManager.enableCAN();
    }

    async disableCAN() {
        this.log('发送禁用CAN控制命令', 'info');
        await this.serialManager.disableCAN();
    }

    // 传感器控制方法
    async enableSensor() {
        this.log('发送启用传感器数据推送命令', 'info');
        await this.serialManager.enableSensor();
    }

    async disableSensor() {
        this.log('发送禁用传感器数据推送命令', 'info');
        await this.serialManager.disableSensor();
    }

    // 映射数据控制方法
    async enableMapping() {
        this.log('发送启用映射数据推送命令', 'info');
        await this.serialManager.enableMapping();
    }

    async disableMapping() {
        this.log('发送禁用映射数据推送命令', 'info');
        await this.serialManager.disableMapping();
    }

    // 串口配置方法
    /**
     * 从UI更新串口配置
     */
    updateSerialConfigFromUI() {
        try {
            if (!this.serialManager) {
                console.warn('串口管理器未初始化，跳过配置更新');
                return;
            }
            
            const config = {
                baudRate: this.elements.baudRate ? parseInt(this.elements.baudRate.value) : 115200,
                dataBits: this.elements.dataBits ? parseInt(this.elements.dataBits.value) : 8,
                stopBits: this.elements.stopBits ? parseInt(this.elements.stopBits.value) : 1,
                parity: this.elements.parity ? this.elements.parity.value : 'none',
                flowControl: this.elements.flowControl ? this.elements.flowControl.value : 'none',
                timeout: this.elements.timeout ? parseInt(this.elements.timeout.value) : 1000
            };
            
            this.serialManager.updateSerialConfig(config);
            console.log('串口配置已从UI更新:', config);
        } catch (error) {
            console.error('更新串口配置失败:', error);
        }
    }

    /**
     * 保存串口配置
     */
    saveSerialConfig() {
        this.updateSerialConfigFromUI();
        const success = this.serialManager.saveSerialConfig();
        if (success) {
            this.showSuccess('串口配置已保存');
        } else {
            this.showError('保存串口配置失败');
        }
    }

    /**
     * 加载串口配置
     */
    loadSerialConfig() {
        try {
            if (!this.serialManager) {
                console.warn('串口管理器未初始化，跳过配置加载');
                return;
            }
            
            const success = this.serialManager.loadSerialConfig();
            if (success) {
                this.updateUIFromSerialConfig();
                console.log('串口配置已从本地存储加载');
            } else {
                console.log('未找到保存的串口配置，使用默认配置');
            }
        } catch (error) {
            console.error('加载串口配置失败:', error);
        }
    }

    /**
     * 重置串口配置
     */
    resetSerialConfig() {
        this.serialManager.resetSerialConfig();
        this.updateUIFromSerialConfig();
        this.showSuccess('串口配置已重置为默认值');
    }

    /**
     * 从串口配置更新UI
     */
    updateUIFromSerialConfig() {
        try {
            if (!this.serialManager) {
                console.warn('串口管理器未初始化，跳过UI更新');
                return;
            }
            
            const config = this.serialManager.getSerialConfig();
            
            if (this.elements.baudRate) this.elements.baudRate.value = config.baudRate;
            if (this.elements.dataBits) this.elements.dataBits.value = config.dataBits;
            if (this.elements.stopBits) this.elements.stopBits.value = config.stopBits;
            if (this.elements.parity) this.elements.parity.value = config.parity;
            if (this.elements.flowControl) this.elements.flowControl.value = config.flowControl;
            if (this.elements.timeout) this.elements.timeout.value = config.timeout;
        } catch (error) {
            console.error('更新UI配置失败:', error);
        }
    }

    /**
     * 刷新串口端口列表
     */
    async refreshSerialPorts() {
        try {
            // Web Serial API 不直接支持获取端口列表
            // 这里只是提示用户重新选择端口
            this.showSuccess('请重新点击"连接串口"按钮选择端口');
        } catch (error) {
            this.showError('刷新端口失败: ' + error.message);
        }
    }

    /**
     * 更新端口信息显示
     * @param {Object} portInfo - 端口信息
     */
    updatePortInfo(portInfo) {
        // 更新端口名称
        this.elements.currentPort.textContent = portInfo.name;
        
        // 更新端口详细信息
        if (portInfo.id) {
            this.elements.portId.textContent = portInfo.id;
            this.elements.portManufacturer.textContent = portInfo.manufacturer || '-';
            this.elements.portProductId.textContent = portInfo.productId || '-';
            this.elements.portVendorId.textContent = portInfo.vendorId || '-';
            
            // 显示详细信息
            this.elements.portDetails.style.display = 'block';
        } else {
            // 隐藏详细信息
            this.elements.portDetails.style.display = 'none';
        }
    }

    /**
     * 销毁应用程序
     */
    dispose() {
        if (this.serialManager) {
            this.serialManager.disconnect();
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// 应用程序启动
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，启动手部关节传感器应用程序...');
    
    // 检查浏览器兼容性
    if (!('serial' in navigator)) {
        console.warn('浏览器不支持Web Serial API');
        alert('请使用Chrome、Edge或Opera浏览器以获得完整功能支持');
    }
    
    // 检查所有必要的DOM元素是否存在
    const requiredElements = [
        'connect-btn', 'disconnect-btn', 'reset-values', 'toggle-animation',
        'packet-count', 'update-rate', 'last-update',
        'status-btn', 'system-response',
        'quick-start-btn', 'quick-finish-btn',
        'anchor-hand', 'anchor-finger1', 'anchor-finger2',
        'anchor-start-btn', 'anchor-record-btn', 'anchor-apply-btn',
        'save-calibration-btn', 'load-calibration-btn', 'clear-calibration-btn', 'reset-calibration-btn',
        'can-enable-btn', 'can-disable-btn',
        'sensor-enable-btn', 'sensor-disable-btn',
        'mapping-enable-btn', 'mapping-disable-btn',
        'baud-rate', 'data-bits', 'stop-bits', 'parity', 'flow-control',
        'timeout', 'save-config', 'load-config', 'reset-config', 'refresh-ports',
        'current-port', 'port-details', 'port-id', 'port-manufacturer',
        'port-product-id', 'port-vendor-id',
        'log-container', 'clear-log-btn'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('缺失的DOM元素:', missingElements);
        alert('页面加载不完整，请刷新页面重试。缺失元素: ' + missingElements.join(', '));
        return;
    }
    
    console.log('所有DOM元素检查通过，开始初始化应用程序...');
    
    // 创建应用程序实例
    window.handSensorApp = new HandSensorApp();
    
    // 添加全局错误处理
    window.addEventListener('error', (event) => {
        console.error('全局错误:', event.error);
    });
    
    // 添加未处理的Promise拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的Promise拒绝:', event.reason);
    });
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.handSensorApp) {
        window.handSensorApp.dispose();
    }
});
