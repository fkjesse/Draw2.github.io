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
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded'); // 调试日志
    
    // 获取DOM元素
    prizeList = document.getElementById('prizeList');
    winnerList = document.getElementById('winnerList');
    lotteryButton = document.getElementById('lotteryButton');
    adminButton = document.getElementById('adminButton');
    resetButton = document.getElementById('resetLottery');
    
    // 从localStorage获取最新数据
    prizes = JSON.parse(localStorage.getItem('prizes')) || [];
    users = JSON.parse(localStorage.getItem('users')) || [];
    
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
    updatePrizeList();
    updateWinnerList();
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
        resetButton.addEventListener('click', function() {
            if (confirm('确定要重置抽奖吗？所有记录将被清空。')) {
                // 重置获奖记录
                localStorage.setItem('records', JSON.stringify([]));
                
                // 重置奖品数量为初始值
                prizes = prizes.map(prize => ({
                    ...prize,
                    count: prize.initialCount
                }));
                
                localStorage.setItem('prizes', JSON.stringify(prizes));
                
                // 更新界面
                updatePrizeList();
                updateWinnerList();
                resetSelectedPrize();
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

// 修改开始抽奖函数
function startLottery() {
    if (!selectedPrize) {
        alert('请先选择要抽取的奖品');
        return;
    }

    if (selectedPrize.count <= 0) {
        alert('该奖品已抽完');
        return;
    }

    // 获取所有未中奖的用户
    const records = JSON.parse(localStorage.getItem('records')) || [];
    const winners = new Set(records.map(record => record.userId));
    const availableUsers = users.filter(user => !winners.has(user.id));

    if (availableUsers.length === 0) {
        alert('没有可参与抽奖的用户了！');
        return;
    }

    // 添加抽奖开始的类名
    const selectedPrizeElement = document.querySelector('.selected-prize');
    selectedPrizeElement.classList.add('lottery-started');

    isLotteryRunning = true;
    lotteryButton.textContent = '停止抽奖';
    lotteryButton.classList.add('running');
    
    // 创建抽奖动画，只显示未中奖的用户
    const resultDiv = document.getElementById('lotteryResult');
    resultDiv.innerHTML = '';
    resultDiv.className = 'lottery-result scrolling';
    
    // 开始滚动动画，只从未中奖用户中选择
    animationTimer = setInterval(() => {
        currentAnimationUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
        resultDiv.innerHTML = `
            <div class="rolling-user">
                <img src="${currentAnimationUser.image}" alt="${currentAnimationUser.name}">
                <span>${currentAnimationUser.name}</span>
            </div>
        `;
    }, 100);
}

// 修改停止抽奖函数
function stopLottery() {
    isLotteryRunning = false;
    lotteryButton.textContent = '开始抽奖';
    lotteryButton.classList.remove('running');
    
    clearInterval(animationTimer);
    
    // 从未中奖用户中选择中奖者
    const records = JSON.parse(localStorage.getItem('records')) || [];
    const winners = new Set(records.map(record => record.userId));
    const availableUsers = users.filter(user => !winners.has(user.id));
    
    if (availableUsers.length === 0) {
        alert('没有可参与抽奖的用户了！');
        return;
    }

    // 随机选择一个未中奖用户
    const winnerIndex = Math.floor(Math.random() * availableUsers.length);
    const winner = availableUsers[winnerIndex];
    
    // 更新奖品数量
    selectedPrize.count--;
    prizes = prizes.map(p => p.id === selectedPrize.id ? {...selectedPrize} : p);
    localStorage.setItem('prizes', JSON.stringify(prizes));
    
    // 更新显示的数量并添加动画效果
    const countElement = document.getElementById('selectedPrizeCount');
    countElement.textContent = `剩余数量: ${selectedPrize.count}/${selectedPrize.initialCount}`;
    countElement.classList.add('updating');
    
    setTimeout(() => {
        countElement.classList.remove('updating');
    }, 500);
    
    // 记录中奖信息
    const record = {
        userId: winner.id,
        name: winner.name,
        prize: selectedPrize.name,
        prizeId: selectedPrize.id,
        time: new Date().toLocaleString()
    };
    
    const allRecords = JSON.parse(localStorage.getItem('records')) || [];
    allRecords.unshift(record);
    localStorage.setItem('records', JSON.stringify(allRecords));
    
    // 修改这里：使用 showWinnerResult 而不是 showLotteryResult
    showWinnerResult(winner);
    
    // 更新界面
    updatePrizeList();
    updateWinnerList();
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
function updatePrizeList() {
    const prizes = JSON.parse(localStorage.getItem('prizes')) || [];
    
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
    
    // 更新奖品列表显示
    prizeList.innerHTML = prizes.map(prize => `
        <div class="prize-item ${selectedPrize && selectedPrize.id === prize.id ? 'selected' : ''}" 
             onclick="selectPrize(${prize.id})">
            <img src="${prize.image}" alt="${prize.name}">
            <div class="prize-info">
                <h3>${prize.name}</h3>
                <p>${prize.description}</p>
                <p class="prize-count">剩余数量: ${prize.count}/${prize.initialCount}</p>
            </div>
        </div>
    `).join('');
}

// 更新获奖列表显示
function updateWinnerList() {
    const records = JSON.parse(localStorage.getItem('records')) || [];
    
    // 按奖品分组
    const groupedRecords = records.reduce((acc, record) => {
        if (!acc[record.prize]) {
            acc[record.prize] = [];
        }
        acc[record.prize].push(record);
        return acc;
    }, {});

    // 生成 HTML
    winnerList.innerHTML = Object.keys(groupedRecords).map(prize => `
        <div class="prize-group">
            <h3>${prize}</h3>
            ${groupedRecords[prize].map(winner => `
                <div class="winner-item">
                    <div class="winner-info">
                        <h4>${winner.name}</h4>
                    </div>
                    <button class="delete-winner-btn" 
                            onclick="deleteWinner('${winner.time}', '${prize}', '${winner.prizeId}')"
                            title="删除此记录">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `).join('');

    // 如果没有中奖记录，显示提示信息
    if (records.length === 0) {
        winnerList.innerHTML = '<div class="no-data">暂无中奖记录</div>';
    }
}

// 添加删除获奖记录的函数
function deleteWinner(winnerTime, prizeName, prizeId) {
    if (confirm(`确定要删除 ${prizeName} 的这条中奖记录吗？`)) {
        // 获取所有记录
        let records = JSON.parse(localStorage.getItem('records')) || [];
        
        // 找到要删除的记录
        const recordIndex = records.findIndex(r => 
            r.time === winnerTime && 
            r.prize === prizeName
        );
        
        if (recordIndex !== -1) {
            // 删除记录
            records.splice(recordIndex, 1);
            localStorage.setItem('records', JSON.stringify(records));
            
            // 更新奖品数量
            prizes = JSON.parse(localStorage.getItem('prizes')) || [];
            const prizeToUpdate = prizes.find(p => p.id === parseInt(prizeId));
            
            if (prizeToUpdate) {
                prizeToUpdate.count++;
                localStorage.setItem('prizes', JSON.stringify(prizes));
                
                // 更新当前选中的奖品对象
                if (selectedPrize && selectedPrize.id === parseInt(prizeId)) {
                    selectedPrize = {...prizeToUpdate}; // 创建新对象以避免引用问题
                    const countElement = document.getElementById('selectedPrizeCount');
                    countElement.textContent = `剩余数量: ${selectedPrize.count}/${selectedPrize.initialCount}`;
                    countElement.classList.add('updating');
                    
                    setTimeout(() => {
                        countElement.classList.remove('updating');
                    }, 500);
                }
            }
            
            // 更新界面
            updatePrizeList();
            updateWinnerList();
        }
    }
}

// 修改选择奖品函数
function selectPrize(id) {
    // 从localStorage获取最新奖品数据
    prizes = JSON.parse(localStorage.getItem('prizes')) || [];
    selectedPrize = prizes.find(p => p.id === id);
    
    if (selectedPrize) {
        // 移除之前的抽奖开始状态
        const selectedPrizeElement = document.querySelector('.selected-prize');
        if (selectedPrizeElement) {
            selectedPrizeElement.classList.remove('lottery-started');
        }

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
}

// 将后台管理按钮的点击处理逻辑提取为单独的函数
function handleAdminClick(e) {
    console.log('Admin button clicked'); // 调试日志
    if (e) e.preventDefault(); // 如果是事件对象，阻止默认行为
    
    // 从localStorage获取最新数据
    const currentPrizes = JSON.parse(localStorage.getItem('prizes')) || [];
    const currentUsers = JSON.parse(localStorage.getItem('users')) || [];
    const hasData = currentPrizes.length > 0 || currentUsers.length > 0;
    
    console.log('Has data:', hasData); // 调试日志
    
    if (!hasData) {
        alert('暂无数据，无需进入后台管理');
        return;
    }
    
    // 有数据则跳转
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

// 其他代码保持不变... 
