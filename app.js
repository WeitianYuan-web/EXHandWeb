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
            pingBtn: document.getElementById('ping-btn'),
            versionBtn: document.getElementById('version-btn'),
            statusBtn: document.getElementById('status-btn'),
            systemResponse: document.getElementById('system-response'),
            
            // 校准命令
            cal5pStart: document.getElementById('cal-5p-start'),
            cal5pNext: document.getElementById('cal-5p-next'),
            cal5pReset: document.getElementById('cal-5p-reset'),
            cal5pStatus: document.getElementById('cal-5p-status'),
            
            calQuickStart: document.getElementById('cal-quick-start'),
            calQuickFinish: document.getElementById('cal-quick-finish'),
            calQuickReset: document.getElementById('cal-quick-reset'),
            calQuickStatus: document.getElementById('cal-quick-status'),
            
            anchorFinger1: document.getElementById('anchor-finger1'),
            anchorFinger2: document.getElementById('anchor-finger2'),
            calAnchorStart: document.getElementById('cal-anchor-start'),
            calAnchorRecord: document.getElementById('cal-anchor-record'),
            calAnchorApply: document.getElementById('cal-anchor-apply'),
            calAnchorReset: document.getElementById('cal-anchor-reset'),
            calAnchorStatus: document.getElementById('cal-anchor-status'),
            
            // 传感器命令
            sensorPrintOn: document.getElementById('sensor-print-on'),
            sensorPrintOff: document.getElementById('sensor-print-off'),
            sensorGetData: document.getElementById('sensor-get-data'),
            
            // 参数命令
            paramSensorIdx: document.getElementById('param-sensor-idx'),
            paramMinValue: document.getElementById('param-min-value'),
            paramMaxValue: document.getElementById('param-max-value'),
            paramGet: document.getElementById('param-get'),
            paramSet: document.getElementById('param-set'),
            paramSave: document.getElementById('param-save'),
            paramLoad: document.getElementById('param-load'),
            parameterResponse: document.getElementById('parameter-response'),
            
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
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 设置串口回调
            this.setupSerialCallbacks();
            
            // 加载串口配置（在串口管理器完全初始化后）
            this.loadSerialConfig();
            
            this.isInitialized = true;
            console.log('应用程序初始化完成');
            
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
            if (this.elements.pingBtn) {
                this.elements.pingBtn.addEventListener('click', () => this.ping());
            }
            if (this.elements.versionBtn) {
                this.elements.versionBtn.addEventListener('click', () => this.getVersion());
            }
            if (this.elements.statusBtn) {
                this.elements.statusBtn.addEventListener('click', () => this.getStatus());
            }
            
            // 校准命令按钮
            if (this.elements.cal5pStart) {
                this.elements.cal5pStart.addEventListener('click', () => this.start5PointCalibration());
            }
            if (this.elements.cal5pNext) {
                this.elements.cal5pNext.addEventListener('click', () => this.next5PointStep());
            }
            if (this.elements.cal5pReset) {
                this.elements.cal5pReset.addEventListener('click', () => this.reset5PointCalibration());
            }
            
            if (this.elements.calQuickStart) {
                this.elements.calQuickStart.addEventListener('click', () => this.startQuickCalibration());
            }
            if (this.elements.calQuickFinish) {
                this.elements.calQuickFinish.addEventListener('click', () => this.finishQuickCalibration());
            }
            if (this.elements.calQuickReset) {
                this.elements.calQuickReset.addEventListener('click', () => this.resetQuickCalibration());
            }
            
            if (this.elements.calAnchorStart) {
                this.elements.calAnchorStart.addEventListener('click', () => this.startAnchorCalibration());
            }
            if (this.elements.calAnchorRecord) {
                this.elements.calAnchorRecord.addEventListener('click', () => this.recordAnchorPoint());
            }
            if (this.elements.calAnchorApply) {
                this.elements.calAnchorApply.addEventListener('click', () => this.applyAnchorCalibration());
            }
            if (this.elements.calAnchorReset) {
                this.elements.calAnchorReset.addEventListener('click', () => this.resetAnchorCalibration());
            }
            
            // 传感器命令按钮
            if (this.elements.sensorPrintOn) {
                this.elements.sensorPrintOn.addEventListener('click', () => this.enableSensorPrint());
            }
            if (this.elements.sensorPrintOff) {
                this.elements.sensorPrintOff.addEventListener('click', () => this.disableSensorPrint());
            }
            if (this.elements.sensorGetData) {
                this.elements.sensorGetData.addEventListener('click', () => this.getSensorData());
            }
            
            // 参数命令按钮
            if (this.elements.paramGet) {
                this.elements.paramGet.addEventListener('click', () => this.getCalibrationParameter());
            }
            if (this.elements.paramSet) {
                this.elements.paramSet.addEventListener('click', () => this.setCalibrationParameter());
            }
            if (this.elements.paramSave) {
                this.elements.paramSave.addEventListener('click', () => this.saveCalibrationParameters());
            }
            if (this.elements.paramLoad) {
                this.elements.paramLoad.addEventListener('click', () => this.loadCalibrationParameters());
            }
            
            // 校准标签页切换
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.switchCalibrationTab(e.target.dataset.tab));
            });
            
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
            });
            
            // 响应回调
            this.serialManager.setResponseCallback((type, cmd, data) => {
                this.handleResponse(type, cmd, data);
            });
            
            // 错误回调
            this.serialManager.setErrorCallback((error) => {
                this.showError('串口错误: ' + error.message);
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
            this.showLoading('正在连接串口...');
            
            const success = await this.serialManager.connect();
            
            if (success) {
                this.updateConnectionStatus(true);
                this.showSuccess('串口连接成功');
                
                // 开始读取数据
                this.serialManager.startReading();
                
            } else {
                this.updateConnectionStatus(false);
                this.showError('串口连接失败');
            }
            
        } catch (error) {
            console.error('连接串口时出错:', error);
            this.updateConnectionStatus(false);
            this.showError('连接串口失败: ' + error.message);
        }
    }

    /**
     * 断开串口连接
     */
    async disconnectSerial() {
        try {
            await this.serialManager.disconnect();
            this.updateConnectionStatus(false);
            this.showSuccess('串口连接已断开');
            
        } catch (error) {
            console.error('断开串口连接时出错:', error);
            this.showError('断开连接失败: ' + error.message);
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
        const commandButtons = [
            this.elements.pingBtn, this.elements.versionBtn, this.elements.statusBtn,
            this.elements.cal5pStart, this.elements.cal5pNext, this.elements.cal5pReset,
            this.elements.calQuickStart, this.elements.calQuickFinish, this.elements.calQuickReset,
            this.elements.calAnchorStart, this.elements.calAnchorRecord, this.elements.calAnchorApply, this.elements.calAnchorReset,
            this.elements.sensorPrintOn, this.elements.sensorPrintOff, this.elements.sensorGetData,
            this.elements.paramGet, this.elements.paramSet, this.elements.paramSave, this.elements.paramLoad
        ];
        
        commandButtons.forEach(btn => {
            if (btn) btn.disabled = !enabled;
        });
    }

    /**
     * 更新关节数据显示
     * @param {Object} jointData - 关节数据对象
     */
    updateJointDisplay(jointData) {
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        const jointTypes = ['yaw', 'pitch', 'tip'];
        
        fingerNames.forEach(fingerName => {
            jointTypes.forEach(jointType => {
                const dataKey = `${fingerName}${jointType.charAt(0).toUpperCase() + jointType.slice(1)}`;
                const angle = jointData[dataKey];
                
                if (this.jointElements[fingerName] && this.jointElements[fingerName][jointType]) {
                    const elements = this.jointElements[fingerName][jointType];
                    
                    // 更新数值显示
                    elements.value.textContent = `${angle}°`;
                    
                    // 更新进度条
                    const percentage = (angle / 255) * 100;
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
                    
                    // 重置数值显示
                    elements.value.textContent = '0°';
                    
                    // 重置进度条
                    elements.bar.style.width = '0%';
                }
            });
        });
        
        console.log('关节数值已重置');
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
        
        if (type === 'ok') {
            responseText += `状态: 执行成功\n`;
            this.showResponse(this.elements.systemResponse, responseText, 'success');
        } else if (type === 'error') {
            responseText += `状态: 执行失败\n`;
            this.showResponse(this.elements.systemResponse, responseText, 'error');
        } else if (type === 'data') {
            responseText += `数据: ${data.map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`;
            this.showResponse(this.elements.systemResponse, responseText, 'data');
            
            // 特殊处理某些命令的响应
            if (cmd === this.serialManager.COMMANDS.GET_VERSION && data.length >= 3) {
                const version = `${data[0]}.${data[1]}.${data[2]}`;
                responseText += `版本号: ${version}\n`;
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
            0x01: '心跳测试',
            0x02: '获取版本',
            0x03: '获取状态',
            0x10: '开始5点校准',
            0x11: '5点校准下一步',
            0x12: '重置5点校准',
            0x13: '获取5点校准状态',
            0x20: '开始快速校准',
            0x21: '完成快速校准',
            0x22: '重置快速校准',
            0x23: '获取快速校准状态',
            0x30: '开始锚定点校准',
            0x31: '记录锚定点',
            0x32: '应用锚定点参数',
            0x33: '重置锚定点校准',
            0x34: '获取锚定点校准状态',
            0x40: '开启传感器数据打印',
            0x41: '关闭传感器数据打印',
            0x42: '获取传感器数据',
            0x50: '获取校准参数',
            0x51: '设置校准参数',
            0x52: '保存校准参数',
            0x53: '加载校准参数'
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
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message) {
        console.log(message);
        // 可以在这里添加加载动画
    }

    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        console.log('✓', message);
        // 可以在这里添加成功提示
        this.showNotification(message, 'success');
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        console.error('✗', message);
        // 可以在这里添加错误提示
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
    async ping() {
        await this.serialManager.ping();
    }

    async getVersion() {
        await this.serialManager.getVersion();
    }

    async getStatus() {
        await this.serialManager.getStatus();
    }

    // 5点校准方法
    async start5PointCalibration() {
        await this.serialManager.start5PointCalibration();
        this.elements.cal5pStatus.textContent = '校准中...';
    }

    async next5PointStep() {
        await this.serialManager.next5PointStep();
    }

    async reset5PointCalibration() {
        await this.serialManager.reset5PointCalibration();
        this.elements.cal5pStatus.textContent = '未开始';
    }

    // 快速校准方法
    async startQuickCalibration() {
        await this.serialManager.startQuickCalibration();
        this.elements.calQuickStatus.textContent = '校准中...';
    }

    async finishQuickCalibration() {
        await this.serialManager.finishQuickCalibration();
        this.elements.calQuickStatus.textContent = '已完成';
    }

    async resetQuickCalibration() {
        await this.serialManager.resetQuickCalibration();
        this.elements.calQuickStatus.textContent = '未开始';
    }

    // 锚定点校准方法
    async startAnchorCalibration() {
        const finger1 = parseInt(this.elements.anchorFinger1.value);
        const finger2 = parseInt(this.elements.anchorFinger2.value);
        await this.serialManager.startAnchorCalibration(finger1, finger2);
        this.elements.calAnchorStatus.textContent = '校准中...';
    }

    async recordAnchorPoint() {
        await this.serialManager.recordAnchorPoint();
    }

    async applyAnchorCalibration() {
        await this.serialManager.applyAnchorCalibration();
        this.elements.calAnchorStatus.textContent = '已应用';
    }

    async resetAnchorCalibration() {
        await this.serialManager.resetAnchorCalibration();
        this.elements.calAnchorStatus.textContent = '未开始';
    }

    // 传感器控制方法
    async enableSensorPrint() {
        await this.serialManager.enableSensorPrint();
    }

    async disableSensorPrint() {
        await this.serialManager.disableSensorPrint();
    }

    async getSensorData() {
        await this.serialManager.getSensorData();
    }

    // 校准参数管理方法
    async getCalibrationParameter() {
        const sensorIdx = parseInt(this.elements.paramSensorIdx.value);
        await this.serialManager.getCalibrationParameter(sensorIdx);
    }

    async setCalibrationParameter() {
        const sensorIdx = parseInt(this.elements.paramSensorIdx.value);
        const minValue = parseInt(this.elements.paramMinValue.value);
        const maxValue = parseInt(this.elements.paramMaxValue.value);
        
        // 将16位值拆分为高低字节
        const minHigh = (minValue >> 8) & 0xFF;
        const minLow = minValue & 0xFF;
        const maxHigh = (maxValue >> 8) & 0xFF;
        const maxLow = maxValue & 0xFF;
        
        await this.serialManager.setCalibrationParameter(sensorIdx, minHigh, minLow, maxHigh, maxLow);
    }

    async saveCalibrationParameters() {
        await this.serialManager.saveCalibrationParameters();
    }

    async loadCalibrationParameters() {
        await this.serialManager.loadCalibrationParameters();
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
        'packet-count', 'update-rate', 'last-update', 'ping-btn', 'version-btn',
        'status-btn', 'system-response', 'cal-5p-start', 'cal-5p-next',
        'cal-5p-reset', 'cal-5p-status', 'cal-quick-start', 'cal-quick-finish',
        'cal-quick-reset', 'cal-quick-status', 'anchor-finger1', 'anchor-finger2',
        'cal-anchor-start', 'cal-anchor-record', 'cal-anchor-apply', 'cal-anchor-reset',
        'cal-anchor-status', 'sensor-print-on', 'sensor-print-off', 'sensor-get-data',
        'param-sensor-idx', 'param-min-value', 'param-max-value', 'param-get',
        'param-set', 'param-save', 'param-load', 'parameter-response',
        'baud-rate', 'data-bits', 'stop-bits', 'parity', 'flow-control',
        'timeout', 'save-config', 'load-config', 'reset-config', 'refresh-ports',
        'current-port', 'port-details', 'port-id', 'port-manufacturer',
        'port-product-id', 'port-vendor-id'
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
