// 在文件开头添加 IndexedDB 相关代码
let db;
const DB_NAME = 'LotteryDB';
const DB_VERSION = 2;

// 在文件开头添加老虎机相关变量
let slotAnimation = null;
let slotSpeed = 0;
let slotPosition = 0;
const SLOT_ITEM_HEIGHT = 120;
const MAX_SPEED = 30;
const ACCELERATION = 1;
const DECELERATION = 0.98;
let isSlowing = false;

// 初始化 IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // 创建所有需要的存储对象
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('prizes')) {
                db.createObjectStore('prizes', { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains('records')) {
                db.createObjectStore('records', { keyPath: 'time' });
            }
            
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'id' });
            }
        };
    });
}

// 从 IndexedDB 读取数据
async function loadFromDB(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 保存数据到 IndexedDB
async function saveToDB(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // 清除现有数据
        store.clear();
        
        // 添加新数据
        data.forEach(item => store.add(item));
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// 在文件开头声明变量，但不立即获取DOM元素
let prizes = [];
let users = [];
let winners = [];
let selectedPrize = null;

// 在文件开头添加抽奖动画相关变量
let isLotteryRunning = false;
let animationTimer = null;
let currentAnimationUser = null;

// DOM 元素引用
let prizeList;
let winnerList;
let lotteryButton;
let adminButton;
let resetButton;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded'); // 调试日志
    
    try {
        // 初始化 IndexedDB
        await initDB();
        
        // 获取DOM元素
        prizeList = document.getElementById('prizeList');
        winnerList = document.getElementById('winnerList');
        lotteryButton = document.getElementById('lotteryButton');
        adminButton = document.getElementById('adminButton');
        resetButton = document.getElementById('resetLottery');
        
        // 从 IndexedDB 获取最新数据
        prizes = await loadFromDB('prizes') || [];
        users = await loadFromDB('users') || [];
        
        // 初始化按钮事件
        initializeButtons();
        
        // 初始化展开/收起功能
        const togglePrizeList = document.getElementById('togglePrizeList');
        const toggleWinnerList = document.getElementById('toggleWinnerList');

        if (togglePrizeList) {
            togglePrizeList.addEventListener('click', () => {
                const container = document.querySelector('.prize-list-container');
                container.classList.toggle('expanded');
            });
        }

        if (toggleWinnerList) {
            toggleWinnerList.addEventListener('click', () => {
                const container = document.querySelector('.winner-list-container');
                container.classList.toggle('expanded');
            });
        }
        
        // 初始化其他UI
        await updatePrizeList();
        await updateWinnerList();
        
        // 加载背景图片
        await loadBackgroundImage();

        // 初始化抽奖按钮状态
        if (lotteryButton) {
            lotteryButton.innerHTML = '<i class="fas fa-play-circle"></i>开始抽奖';
            lotteryButton.classList.add('start');
        }

        // 添加春节装饰容器
        const decorationsContainer = document.createElement('div');
        decorationsContainer.className = 'festival-decorations';
        document.body.appendChild(decorationsContainer);

        // 启动装饰物掉落效果
        startFestivalDecorations(decorationsContainer);
    } catch (error) {
        console.error('初始化失败:', error);
        alert('初始化数据时出错: ' + error.message);
    }
});

// 修改 initializeButtons 函数
function initializeButtons() {
    console.log('Initializing buttons'); // 调试日志
    
    // 后台管理按钮
    if (adminButton) {
        console.log('Found admin button:', adminButton); // 调试日志
        
        // 使用多种方式绑定事件，以确保至少一种方式生效
        // 方式1：直接绑定函数
        adminButton.onclick = handleAdminClick;
        
        // 方式2：添加事件监听
        adminButton.addEventListener('click', handleAdminClick);
        
        // 方式3：在HTML中添加onclick属性
        adminButton.setAttribute('onclick', 'handleAdminClick()');
    } else {
        console.log('Admin button not found!'); // 调试日志
    }

    // 重置抽奖按钮
    if (resetButton) {
        resetButton.addEventListener('click', async function() {
            if (confirm('确定要重置抽奖吗？所有记录将被清空。')) {
                try {
                    // 重置获奖记录
                    await saveToDB('records', []);
                    
                    // 重置奖品数量为初始值
                    prizes = prizes.map(prize => ({
                        ...prize,
                        count: prize.initialCount
                    }));
                    
                    await saveToDB('prizes', prizes);
                    
                    // 更新界面
                    await updatePrizeList();
                    await updateWinnerList();
                    resetSelectedPrize();
                    
                } catch (error) {
                    console.error('重置抽奖失败:', error);
                    alert('重置抽奖时出错: ' + error.message);
                }
            }
        });
    }

    // 抽奖按钮
    if (lotteryButton) {
        console.log('Found lottery button'); // 调试日志
        lotteryButton.addEventListener('click', function() {
            console.log('Lottery button clicked'); // 调试日志
            
            if (!selectedPrize) {
                alert('请先选择要抽取的奖品！');
                return;
            }

            // 检查是否有参与抽奖的用户
            if (!users || users.length === 0) {
                alert('暂无抽奖用户，请在后台添加用户！');
                return;
            }

            // 检查奖品是否还有剩余
            const currentPrize = prizes.find(p => p.id === selectedPrize.id);
            if (!currentPrize || currentPrize.count <= 0) {
                alert('该奖品已抽完！');
                return;
            }

            if (isLotteryRunning) {
                // 停止抽奖
                stopLottery();
            } else {
                // 开始抽奖
                startLottery();
            }
        });
    }
}

// 添加禁用/启用按钮的辅助函数
function setButtonsState(disabled) {
    // 获取所有需要控制的按钮
    const buttons = [
        document.getElementById('lotteryButton'),
        document.getElementById('adminButton'),
        document.getElementById('resetLottery'),
        ...document.querySelectorAll('.prize-item'), // 奖品列表项
        ...document.querySelectorAll('.delete-winner-btn') // 删除获奖记录按钮
    ];
    
    buttons.forEach(button => {
        if (button) {
            button.style.pointerEvents = disabled ? 'none' : 'auto';
            button.style.opacity = disabled ? '0.5' : '1';
        }
    });
}

// 修改开始抽奖函数
async function startLottery() {
    if (!selectedPrize) {
        alert('请先选择要抽取的奖品');
        return;
    }

    if (selectedPrize.count <= 0) {
        alert('该奖品已抽完');
        return;
    }

    try {
        // 从 IndexedDB 获取最新记录和用户数据
        const records = await loadFromDB('records') || [];
        const users = await loadFromDB('users') || [];
        
        // 获取所有未中奖的用户
        const winners = new Set(records.map(record => record.userId));
        const availableUsers = users.filter(user => !winners.has(user.id));

        if (availableUsers.length === 0) {
            alert('没有可参与抽奖的用户了！');
            return;
        }

        // 添加抽奖运行状态类名到抽奖区域
        document.querySelector('.lottery-area').classList.add('lottery-running');

        isLotteryRunning = true;
        const lotteryButton = document.getElementById('lotteryButton');
        lotteryButton.innerHTML = '<i class="fas fa-stop-circle"></i>停止抽奖';
        lotteryButton.classList.remove('start');
        lotteryButton.classList.add('stop');
        
        // 创建老虎机效果
        const resultDiv = document.getElementById('lotteryResult');
        resultDiv.innerHTML = `
            <div class="slot-machine">
                <div class="slot-reel"></div>
            </div>
        `;
        resultDiv.className = 'lottery-result scrolling';
        
        const slotReel = resultDiv.querySelector('.slot-reel');
        
        // 创建足够多的用户项以形成循环效果
        const createSlotItems = () => {
            return Array(3).fill(availableUsers).flat().map(user => `
                <div class="slot-item" data-user-id="${user.id}">
                    <img src="${user.image}" alt="${user.name}">
                    <span>${user.name}</span>
                </div>
            `).join('');
        };
        
        // 初始化老虎机内容
        slotReel.innerHTML = createSlotItems();
        slotPosition = 0;
        slotSpeed = 0;
        
        // 在动画开始前禁用其他按钮，只保留抽奖按钮可用
        setButtonsState(true);
        if (lotteryButton) {
            lotteryButton.style.pointerEvents = 'auto';
            lotteryButton.style.opacity = '1';
        }
        
        // 开始滚动动画
        const animate = () => {
            // 如果抽奖已经停止，不再继续动画
            if (!isLotteryRunning) {
                cancelAnimationFrame(slotAnimation);
                return;
            }

            if (!isSlowing) {
                slotSpeed = Math.min(slotSpeed + ACCELERATION, MAX_SPEED);
            } else {
                // 如果正在减速，不要继续更新位置
                return;
            }
            
            slotPosition += slotSpeed;
            
            // 重置位置以实现无缝循环
            if (slotPosition >= SLOT_ITEM_HEIGHT * availableUsers.length) {
                slotPosition = 0;
            }
            
            const slotReel = document.querySelector('.slot-reel');
            if (slotReel) {
                slotReel.style.transform = `translateY(-${slotPosition}px)`;
            }
            
            // 只有在抽奖运行时才继续动画
            if (isLotteryRunning) {
                slotAnimation = requestAnimationFrame(animate);
            }
        };
        
        // 确保之前的动画被取消
        if (slotAnimation) {
            cancelAnimationFrame(slotAnimation);
        }
        
        // 重置状态
        isLotteryRunning = true;
        isSlowing = false;
        slotSpeed = 0;
        
        slotAnimation = requestAnimationFrame(animate);
        
    } catch (error) {
        console.error('开始抽奖失败:', error);
        alert('开始抽奖时出错: ' + error.message);
        // 发生错误时重新启用按钮
        setButtonsState(false);
    }
}

// 修改停止抽奖函数
async function stopLottery() {
    // 立即停止开始时的动画
    isLotteryRunning = false;
    isSlowing = true;
    
    // 禁用所有按钮
    setButtonsState(true);
    
    if (slotAnimation) {
        cancelAnimationFrame(slotAnimation);
        slotAnimation = null;
    }

    const lotteryButton = document.getElementById('lotteryButton');
    lotteryButton.innerHTML = '<i class="fas fa-play-circle"></i>开始抽奖';
    lotteryButton.classList.remove('stop');
    lotteryButton.classList.add('start');

    try {
        const records = await loadFromDB('records') || [];
        const users = await loadFromDB('users') || [];
        
        const winners = new Set(records.map(record => record.userId));
        const availableUsers = users.filter(user => !winners.has(user.id));
        
        if (availableUsers.length === 0) {
            alert('没有可参与抽奖的用户了！');
            return;
        }

        const winnerIndex = Math.floor(Math.random() * availableUsers.length);
        const winner = availableUsers[winnerIndex];
        
        // 计算最终位置
        const itemHeight = SLOT_ITEM_HEIGHT;
        const currentPosition = slotPosition % (itemHeight * availableUsers.length);
        const targetPosition = winnerIndex * itemHeight;
        let additionalRotations = 2 * itemHeight * availableUsers.length;
        
        let totalDistance = additionalRotations + targetPosition - currentPosition;
        if (totalDistance < 0) {
            totalDistance += itemHeight * availableUsers.length;
        }
        
        // 使用更长的减速时间
        const animationDuration = 4000; // 增加到4秒
        let startPosition = slotPosition;
        let startTime = null;
        
        // 使用更平滑的缓动函数
        const easeOutQuart = t => 1 - Math.pow(1 - t, 4); // 四次方缓动
        
        const slowDown = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / animationDuration, 1);
            
            if (!isSlowing) return;
            
            const currentProgress = easeOutQuart(progress);
            slotPosition = startPosition + totalDistance * currentProgress;
            
            const slotReel = document.querySelector('.slot-reel');
            if (slotReel) {
                slotReel.style.transform = `translateY(-${slotPosition}px)`;
                
                if (progress > 0.9) {
                    const fadeProgress = (progress - 0.9) / 0.1;
                    slotReel.style.opacity = (1 - fadeProgress * 0.2).toString();
                }
            }
            
            if (progress < 1 && isSlowing) {
                slotAnimation = requestAnimationFrame(slowDown);
            } else {
                // 确保完全停止
                isSlowing = false;
                cancelAnimationFrame(slotAnimation);
                slotAnimation = null;
                
                // 在这里直接设置最终位置
                if (slotReel) {
                    slotReel.style.transition = 'none';
                    slotReel.style.transform = `translateY(-${targetPosition}px)`;
                    slotReel.offsetHeight;
                }
                
                setTimeout(() => {
                    finishLottery(winner);
                }, 300);
            }
        };
        
        slotAnimation = requestAnimationFrame(slowDown);
        
    } catch (error) {
        console.error('停止抽奖失败:', error);
        alert('停止抽奖时出错: ' + error.message);
        // 发生错误时重新启用按钮
        setButtonsState(false);
    }
}

// 修改完成抽奖函数
async function finishLottery(winner) {
    // 确保所有动画状态被重置
    isLotteryRunning = false;
    isSlowing = false;
    slotSpeed = 0;
    slotPosition = 0;
    
    // 确保取消所有动画
    if (slotAnimation) {
        cancelAnimationFrame(slotAnimation);
        slotAnimation = null;
    }
    
    try {
        // 获取老虎机元素
        const slotReel = document.querySelector('.slot-reel');
        const slotMachine = document.querySelector('.slot-machine');
        
        if (slotMachine && slotReel) {
            // 先淡出老虎机
            slotMachine.style.transition = 'opacity 0.3s ease-out';
            slotMachine.style.opacity = '0';
            
            // 等待淡出完成
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 更新奖品信息和记录
        selectedPrize.count--;
        prizes = prizes.map(p => p.id === selectedPrize.id ? {...selectedPrize} : p);
        await saveToDB('prizes', prizes);
        
        const countElement = document.getElementById('selectedPrizeCount');
        countElement.textContent = `剩余数量: ${selectedPrize.count}/${selectedPrize.initialCount}`;
        countElement.classList.add('updating');
        
        setTimeout(() => {
            countElement.classList.remove('updating');
        }, 500);
        
        const record = {
            userId: winner.id,
            name: winner.name,
            prize: selectedPrize.name,
            prizeId: selectedPrize.id,
            time: new Date().toLocaleString()
        };
        
        const records = await loadFromDB('records') || [];
        records.unshift(record);
        await saveToDB('records', records);
        
        // 显示中奖结果
        const resultDiv = document.getElementById('lotteryResult');
        resultDiv.style.opacity = '0';
        resultDiv.className = 'lottery-result winner';
        resultDiv.innerHTML = `
            <div class="winner-announcement">
                <div class="winner-info">
                    <img src="${winner.image}" alt="${winner.name}">
                    <h3>恭喜 ${winner.name}</h3>
                    <p>获得 ${selectedPrize.name}</p>
                </div>
                <div class="winner-effect">🎉</div>
            </div>
        `;
        
        // 使用 requestAnimationFrame 实现平滑淡入
        requestAnimationFrame(() => {
            resultDiv.style.transition = 'opacity 0.5s ease-in';
            resultDiv.style.opacity = '1';
        });
        
        // 添加烟花效果
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const x = centerX + (Math.random() - 0.5) * 400;
                const y = centerY + (Math.random() - 0.5) * 200;
                createFirework(x, y);
            }, 200 + i * 200);
        }
        
        await updatePrizeList();
        await updateWinnerList();
        
        // 重新启用所有按钮
        setButtonsState(false);
        
    } catch (error) {
        console.error('完成抽奖过程出错:', error);
        alert('完成抽奖过程中出错: ' + error.message);
        // 发生错误时重新启用按钮
        setButtonsState(false);
    }
}

// 添加创建烟花效果的函数
function createFirework(x, y) {
    const firework = document.createElement('div');
    firework.className = 'firework';
    firework.style.left = x + 'px';
    firework.style.top = y + 'px';

    // 使用更柔和的颜色
    const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#607D8B'];
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const angle = (i / 30) * Math.PI * 2;
        const velocity = 50 + Math.random() * 50;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        firework.appendChild(particle);
    }

    document.body.appendChild(firework);
    
    setTimeout(() => {
        document.body.removeChild(firework);
    }, 1000);
}

// 确保 showWinnerResult 函数正确实现
function showWinnerResult(winner) {
    const resultDiv = document.getElementById('lotteryResult');
    resultDiv.className = 'lottery-result winner';
    resultDiv.innerHTML = `
        <div class="winner-announcement">
            <div class="winner-info">
                <img src="${winner.image}" alt="${winner.name}">
                <h3>恭喜 ${winner.name}</h3>
                <p>获得 ${selectedPrize.name}</p>
            </div>
            <div class="winner-effect">🎉</div>
        </div>
    `;

    // 添加多个烟花效果
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 创建多个烟花，有随机延迟
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const x = centerX + (Math.random() - 0.5) * 400;
            const y = centerY + (Math.random() - 0.5) * 200;
            createFirework(x, y);
        }, i * 200); // 每个烟花间隔200ms
    }
}

// 重置选中奖品的辅助函数
function resetSelectedPrize() {
    selectedPrize = null;
    const elements = {
        image: document.getElementById('selectedPrizeImage'),
        name: document.getElementById('selectedPrizeName'),
        desc: document.getElementById('selectedPrizeDesc'),
        count: document.getElementById('selectedPrizeCount'),
        result: document.getElementById('lotteryResult')
    };
    
    if (elements.image) elements.image.src = '';
    if (elements.name) elements.name.textContent = '';
    if (elements.desc) elements.desc.textContent = '';
    if (elements.count) elements.count.textContent = '';
    if (elements.result) {
        elements.result.innerHTML = '';
        elements.result.className = 'lottery-result'; // 重置类名
    }
}

// 更新奖品列表显示
async function updatePrizeList() {
    try {
        const prizes = await loadFromDB('prizes') || [];
        
        if (prizes.length === 0) {
            prizeList.innerHTML = `
                <div class="no-data">
                    暂无奖品数据
                    <br><br>
                    <button class="nav-button" onclick="window.location.href='admin.html'">
                        <i class="fas fa-plus"></i> 点击进入后台添加
                    </button>
                </div>`;
            return;
        }
        
        prizeList.innerHTML = prizes.map(prize => {
            // 根据奖品名称判断等级
            let level = 0;
            if (prize.name.includes('一等奖')) level = 1;
            else if (prize.name.includes('二等奖')) level = 2;
            else if (prize.name.includes('三等奖')) level = 3;
            
            return `
                <div class="prize-item ${selectedPrize && selectedPrize.id === prize.id ? 'selected' : ''}" 
                     onclick="selectPrize(${prize.id})"
                     data-prize-level="${level}">
                    <img src="${prize.image}" alt="${prize.name}">
                    <div class="prize-info">
                        <h3>${prize.name}</h3>
                        <p>${prize.description}</p>
                        <p class="prize-count">剩余数量: ${prize.count}/${prize.initialCount}</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('更新奖品列表失败:', error);
        alert('更新奖品列表时出错: ' + error.message);
    }
}

// 更新获奖列表显示
async function updateWinnerList() {
    try {
        // 获取获奖记录
        const records = await loadFromDB('records') || [];
        
        // 如果没有中奖记录，显示提示信息
        if (!records || records.length === 0) {
            winnerList.innerHTML = '<div class="no-data">暂无中奖记录</div>';
            return;
        }

        // 按奖品分组
        const groupedRecords = {};
        for (const record of records) {
            if (!groupedRecords[record.prize]) {
                groupedRecords[record.prize] = [];
            }
            // 判断奖品等级
            let level = 0;
            if (record.prize.includes('一等奖')) level = 1;
            else if (record.prize.includes('二等奖')) level = 2;
            else if (record.prize.includes('三等奖')) level = 3;
            
            groupedRecords[record.prize].push({...record, level});
        }

        // 生成 HTML
        let html = '';
        for (const [prizeName, winners] of Object.entries(groupedRecords)) {
            html += `
                <div class="prize-group">
                    <h3>${prizeName}</h3>
                    ${winners.map(winner => `
                        <div class="winner-item" data-prize-level="${winner.level}">
                            <div class="winner-info">
                                <h4>${winner.name}</h4>
                            </div>
                            <button class="delete-winner-btn" 
                                    onclick="deleteWinner('${winner.time}', '${prizeName}', '${winner.prizeId}')"
                                    title="删除此记录">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 更新 DOM
        winnerList.innerHTML = html;
        
    } catch (error) {
        console.error('更新获奖列表失败:', error);
        alert('更新获奖列表时出错: ' + error.message);
    }
}

// 添加删除获奖记录的函数
async function deleteWinner(winnerTime, prizeName, prizeId) {
    if (confirm(`确定要删除 ${prizeName} 的这条中奖记录吗？`)) {
        try {
            // 获取所有记录
            let records = await loadFromDB('records') || [];
            
            // 找到要删除的记录
            const recordIndex = records.findIndex(r => 
                r.time === winnerTime && 
                r.prize === prizeName
            );
            
            if (recordIndex !== -1) {
                // 删除记录
                records.splice(recordIndex, 1);
                await saveToDB('records', records);
                
                // 更新奖品数量
                prizes = await loadFromDB('prizes') || [];
                const prizeToUpdate = prizes.find(p => p.id === parseInt(prizeId));
                
                if (prizeToUpdate) {
                    prizeToUpdate.count++;
                    await saveToDB('prizes', prizes);
                    
                    // 更新当前选中的奖品对象
                    if (selectedPrize && selectedPrize.id === parseInt(prizeId)) {
                        selectedPrize = {...prizeToUpdate};
                        const countElement = document.getElementById('selectedPrizeCount');
                        countElement.textContent = `剩余数量: ${selectedPrize.count}/${selectedPrize.initialCount}`;
                        countElement.classList.add('updating');
                        
                        setTimeout(() => {
                            countElement.classList.remove('updating');
                        }, 500);
                    }
                }
                
                // 更新界面
                await updatePrizeList();
                await updateWinnerList();
            }
        } catch (error) {
            console.error('删除获奖记录失败:', error);
            alert('删除获奖记录时出错: ' + error.message);
        }
    }
}

// 修改选择奖品函数
async function selectPrize(id) {
    try {
        // 从 IndexedDB 获取最新奖品数据
        const prizes = await loadFromDB('prizes') || [];
        selectedPrize = prizes.find(p => p.id === id);
        
        if (selectedPrize) {
            // 移除抽奖运行状态，显示奖品展示区域
            document.querySelector('.lottery-area').classList.remove('lottery-running');

            // 更新选中奖品的显示
            document.getElementById('selectedPrizeImage').src = selectedPrize.image;
            document.getElementById('selectedPrizeName').textContent = selectedPrize.name;
            document.getElementById('selectedPrizeDesc').textContent = selectedPrize.description;
            document.getElementById('selectedPrizeCount').textContent = 
                `剩余数量: ${selectedPrize.count}/${selectedPrize.initialCount}`;
            
            // 清除抽奖结果区域
            const resultDiv = document.getElementById('lotteryResult');
            resultDiv.innerHTML = '';
            resultDiv.className = 'lottery-result';
            
            // 更新奖品列表的选中状态
            updatePrizeList();
        }
    } catch (error) {
        console.error('选择奖品失败:', error);
        alert('选择奖品时出错: ' + error.message);
    }
}

// 将 selectPrize 函数添加到 window 对象
window.selectPrize = selectPrize;

// 将后台管理按钮的点击处理逻辑提取为单独的函数
function handleAdminClick(e) {
    console.log('Admin button clicked'); // 调试日志
    if (e) e.preventDefault(); // 如果是事件对象，阻止默认行为
    
    // 直接跳转到后台页面
    console.log('Redirecting to admin page...'); // 调试日志
    try {
        window.location.href = 'admin.html';
    } catch (error) {
        console.error('Navigation failed:', error);
        // 尝试其他导航方式
        window.location.replace('admin.html');
    }
}

// 将函数添加到全局作用域，以便HTML onclick属性可以访问
window.handleAdminClick = handleAdminClick;

// 修改重置抽奖函数
function resetLottery() {
    // 移除抽奖开始状态
    const selectedPrizeElement = document.querySelector('.selected-prize');
    if (selectedPrizeElement) {
        selectedPrizeElement.classList.remove('lottery-started');
    }

    // ... 其他重置逻辑 ...
}

// 将 stopLottery 函数添加到 window 对象
window.stopLottery = stopLottery;

// 将 startLottery 函数添加到 window 对象
window.startLottery = startLottery;

// 在初始化函数中添加背景图片加载
async function loadBackgroundImage() {
    try {
        const settings = await loadFromDB('settings') || [];
        const backgroundSetting = settings.find(s => s.id === 'background');
        
        if (backgroundSetting) {
            document.body.style.backgroundImage = `url('${backgroundSetting.value}')`;
        }
    } catch (error) {
        console.error('加载背景图片失败:', error);
    }
}

// 更新装饰物生成函数
function createFestivalDecoration(container) {
    const decorations = [
        { content: '🏮', class: 'lantern', size: '28px', duration: '8s' },
        { content: '福', class: 'fu', size: '36px', duration: '10s' },
        { content: '🧨', class: 'firecracker', size: '26px', duration: '7s' },
        { content: '🪙', class: 'coin', size: '24px', duration: '6s' },
        { content: '春', class: 'spring', size: '32px', duration: '9s' },
        { content: '🧧', class: 'envelope', size: '30px', duration: '8.5s' },
        { content: '🌺', class: 'flower', size: '24px', duration: '8s' },
        { content: '🍊', class: 'mandarin', size: '24px', duration: '6.5s' },
        // 添加自定义图标
        { content: '', class: 'custom-icon', size: '66px', duration: '6.6s' }
    ];
    
    const decoration = decorations[Math.floor(Math.random() * decorations.length)];
    const element = document.createElement('div');
    
    element.className = `falling-item ${decoration.class}`;
    
    // 对于自定义图标使用特殊处理
    if (decoration.class === 'custom-icon') {
        element.style.backgroundImage = "url('./icon/icon1.jpg')";
        element.style.backgroundSize = 'contain';
        element.style.backgroundRepeat = 'no-repeat';
        element.style.width = decoration.size;
        element.style.height = decoration.size;
    } else {
        element.textContent = decoration.content;
    }
    
    element.style.fontSize = decoration.size;
    element.style.left = `${Math.random() * 100}%`;
    element.style.animationDuration = decoration.duration;
    
    // 添加随机效果
    const effects = [];
    
    // 50%概率添加摇摆效果
    if (Math.random() > 0.5) {
        effects.push('swing 2s ease-in-out infinite');
    }
    
    // 30%概率添加闪烁效果
    if (Math.random() > 0.7) {
        effects.push('sparkle 1.5s ease-in-out infinite');
    }
    
    // 添加随机初始旋转角度
    const rotation = Math.random() * 360;
    element.style.transform = `rotate(${rotation}deg)`;
    
    // 添加随机缩放
    const scale = 0.8 + Math.random() * 0.4;
    element.style.transform += ` scale(${scale})`;
    
    // 合并所有动画效果
    if (effects.length > 0) {
        element.style.animation = `falling ${decoration.duration} linear infinite, ${effects.join(', ')}`;
    }
    
    container.appendChild(element);
    
    // 动画结束后移除元素
    element.addEventListener('animationend', () => {
        if (container.contains(element)) {
            container.removeChild(element);
        }
    });
}

// 优化装饰物密度控制
function controlDecorationDensity(container) {
    let lastCreationTime = 0;
    const minInterval = 300; // 减少间隔时间，增加密度
    const maxDecorations = 60; // 增加最大装饰物数量
    
    function update(currentTime) {
        if (currentTime - lastCreationTime > minInterval && 
            container.children.length < maxDecorations) {
            createFestivalDecoration(container);
            lastCreationTime = currentTime;
        }
        requestAnimationFrame(update);
    }
    
    requestAnimationFrame(update);
}

// 修改启动装饰效果函数
function startFestivalDecorations(container) {
    // 使用性能优化版本的控制函数
    controlDecorationDensity(container);
}

// 其他代码保持不变... 