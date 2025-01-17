// 在文件开头添加变量声明
let users = JSON.parse(localStorage.getItem('users')) || [];
let prizes = JSON.parse(localStorage.getItem('prizes')) || [];
let currentSort = {
    field: 'registerTime',
    order: 'desc'
};
let pageSize = 10;
let currentPage = 1;

// 在文件开头添加 IndexedDB 相关代码
let db;
const DB_NAME = 'LotteryDB';
const DB_VERSION = 2;

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
            
            // 创建所需的存储对象（如果不存在）
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

// 标签页切换功能
function initializeTabs() {
    const menuItems = document.querySelectorAll('.menu-item');
    const panels = document.querySelectorAll('.content-panel');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.dataset.tab;
            
            // 更新菜单项状态
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');
            
            // 更新面板显示
            panels.forEach(panel => {
                if (panel.id === targetTab + 'Panel') {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });
}

// 图片预览功能
function showImagePreview(imageSrc) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.innerHTML = `
        <div class="modal-content" style="background: transparent; box-shadow: none;">
            <img src="${imageSrc}" style="max-width: 90vw; max-height: 90vh; object-fit: contain;">
        </div>
    `;
    
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.body.appendChild(modal);
}

// 删除用户功能
function deleteUser(id) {
    if (confirm('确定要删除该用户吗？')) {
        users = users.filter(user => user.id !== id);
        saveUsersToStorage();
        loadUserData(currentPage);
    }
}

// 添加用户模态框
function showAddUserModal() {
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    document.getElementById('userForm').reset();
}

// 更新页面信息
function updatePageInfo(total, page) {
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    
    const totalElement = document.getElementById('totalUsers');
    const currentPageElement = document.getElementById('currentPageInfo');
    
    if (totalElement) totalElement.textContent = total;
    if (currentPageElement) currentPageElement.textContent = `${start}-${end}`;
}

// 更新分页控件
function updatePagination(total, page) {
    const pagination = document.querySelector('#userPanel .pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(total / pageSize);
    let html = '';
    
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <button class="page-button ${i === page ? 'active' : ''}"
                    onclick="loadUserData(${i})">
                ${i}
            </button>
        `;
    }
    
    pagination.innerHTML = html;
}

// 修改现有的数据加载和保存函数
async function loadUserData(page = 1, search = '') {
    try {
        // 从 IndexedDB 加载数据
        users = await loadFromDB('users');
        
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        
        // 筛选
        let filteredUsers = users.filter(user => 
            user.name.toLowerCase().includes(search.toLowerCase())
        );
        
        // 排序
        filteredUsers.sort((a, b) => {
            const aValue = a[currentSort.field];
            const bValue = b[currentSort.field];
            return currentSort.order === 'asc' 
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        });
        
        // 分页
        const pagedUsers = filteredUsers.slice(start, end);
        
        // 更新表格
        tbody.innerHTML = pagedUsers.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>
                    <img src="${user.image}" alt="${user.name}" 
                         style="width: 80px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                         onclick="showImagePreview('${user.image}')">
                </td>
                <td>${user.registerTime}</td>
                <td>
                    <button class="tool-button" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // 更新页面信息
        updatePageInfo(filteredUsers.length, page);
        updatePagination(filteredUsers.length, page);
    } catch (error) {
        console.error('加载用户数据失败:', error);
        alert('加载用户数据时出错: ' + error.message);
    }
}

// 修改保存用户数据的函数
async function saveUsersToStorage() {
    try {
        await saveToDB('users', users);
    } catch (error) {
        console.error('保存用户数据失败:', error);
        alert('保存用户数据时出错: ' + error.message);
        throw error;
    }
}

// 修改加载奖品数据的函数
async function loadPrizeData() {
    try {
        prizes = await loadFromDB('prizes');
        const grid = document.getElementById('prizeGrid');
        if (!grid) return;

        grid.innerHTML = prizes.length > 0 
            ? prizes.map(prize => `
                <div class="prize-card">
                    <div class="prize-actions">
                        <button class="tool-button" onclick="editPrize(${prize.id})" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="tool-button" onclick="deletePrize(${prize.id})" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <img src="${prize.image}" alt="${prize.name}" 
                         onclick="showImagePreview('${prize.image}')">
                    <div class="prize-info">
                        <h3>${prize.name}</h3>
                        <p>${prize.description}</p>
                        <p>剩余数量: ${prize.count}/${prize.initialCount}</p>
                    </div>
                </div>
            `).join('')
            : '<div class="no-data">暂无奖品，请点击右上角添加</div>';
    } catch (error) {
        console.error('加载奖品数据失败:', error);
        alert('加载奖品数据时出错: ' + error.message);
    }
}

// 修改保存奖品数据的函数
async function savePrizesToStorage() {
    try {
        await saveToDB('prizes', prizes);
    } catch (error) {
        console.error('保存奖品数据失败:', error);
        alert('保存奖品数据时出错: ' + error.message);
        throw error;
    }
}

// 修改加载抽奖记录的函数
async function loadRecordData() {
    try {
        const records = await loadFromDB('records');
        const tbody = document.getElementById('recordTableBody');
        if (!tbody) return;

        tbody.innerHTML = records.length > 0
            ? records.map(record => `
                <tr>
                    <td>${record.name}</td>
                    <td>${record.prize}</td>
                    <td>${record.time}</td>
                    <td>已领取</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="no-data">暂无抽奖记录</td></tr>';
    } catch (error) {
        console.error('加载抽奖记录失败:', error);
        alert('加载抽奖记录时出错: ' + error.message);
    }
}

// 添加 initializeEventListeners 函数
function initializeEventListeners() {
    // 初始化搜索功能
    const userSearch = document.querySelector('#userPanel .search-input');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            loadUserData(1, e.target.value);
        });
    }

    // 初始化排序功能
    const sortableHeaders = document.querySelectorAll('.sortable');
    sortableHeaders.forEach(th => {
        if (th) {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (currentSort.field === field) {
                    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = field;
                    currentSort.order = 'asc';
                }
                loadUserData(currentPage);
            });
        }
    });

    // 初始化批量上传功能
    const batchUploadInput = document.getElementById('batchUserUpload');
    if (batchUploadInput) {
        batchUploadInput.addEventListener('change', handleBatchUpload);
    }

    // 初始化页面大小选择器
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            pageSize = parseInt(pageSizeSelect.value);
            currentPage = 1;
            loadUserData(currentPage);
        });
    }
}

// 添加批量上传处理函数
async function handleBatchUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 100) { // 添加文件数量限制
        alert('一次最多只能上传100个文件');
        event.target.value = '';
        return;
    }

    // 显示上传进度
    const totalFiles = files.length;
    let processedFiles = 0;
    let failedFiles = [];
    
    const progressDiv = document.createElement('div');
    progressDiv.className = 'upload-progress';
    progressDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
    `;
    document.body.appendChild(progressDiv);

    try {
        for (let file of files) {
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                failedFiles.push(`${file.name} (不是图片文件)`);
                continue;
            }

            // 检查文件大小
            if (file.size > 5 * 1024 * 1024) {
                failedFiles.push(`${file.name} (超过5MB限制)`);
                continue;
            }

            // 更新进度显示
            processedFiles++;
            progressDiv.innerHTML = `
                <div>正在处理: ${processedFiles}/${totalFiles}</div>
                <div style="font-size: 0.9em; color: #666;">
                    当前文件: ${file.name}
                </div>
            `;

            try {
                await processUserImage(file);
            } catch (error) {
                failedFiles.push(`${file.name} (处理失败)`);
            }
        }

        // 更新界面
        loadUserData(currentPage);
        
        // 显示处理结果
        if (failedFiles.length > 0) {
            alert(`导入完成！\n\n成功：${processedFiles - failedFiles.length}个\n失败：${failedFiles.length}个\n\n失败文件：\n${failedFiles.join('\n')}`);
        } else {
            alert(`导入完成！成功处理 ${processedFiles} 个文件`);
        }
    } catch (error) {
        alert('导入过程中出现错误: ' + error.message);
    } finally {
        // 清理
        event.target.value = '';
        document.body.removeChild(progressDiv);
    }
}

// 添加处理单个用户图片的函数
function processUserImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // 使用文件名（去除扩展名）作为用户名
                const userName = file.name.replace(/\.[^/.]+$/, "");
                
                // 创建新用户
                const newUser = {
                    id: Date.now() + Math.random(), // 确保ID唯一
                    name: userName,
                    image: e.target.result,
                    registerTime: new Date().toLocaleString()
                };

                // 添加到用户列表
                users.unshift(newUser);
                saveUsersToStorage();
                
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error(`处理文件 ${file.name} 失败`));
        reader.readAsDataURL(file);
    });
}

// 添加编辑奖品功能
function editPrize(id) {
    const prize = prizes.find(p => p.id === id);
    if (!prize) return;

    // 打开模态框
    const modal = document.getElementById('prizeModal');
    modal.classList.add('active');
    
    // 更新模态框标题
    modal.querySelector('.modal-header h3').textContent = '编辑奖品';
    
    // 填充表单数据
    const form = document.getElementById('prizeForm');
    form.dataset.mode = 'edit';
    form.dataset.editId = id;
    
    form.querySelector('[name="name"]').value = prize.name;
    form.querySelector('[name="description"]').value = prize.description;
    form.querySelector('[name="count"]').value = prize.count;
    
    // 显示当前图片预览
    const currentImagePreview = document.createElement('div');
    currentImagePreview.className = 'current-image-preview';
    currentImagePreview.innerHTML = `
        <p>当前图片：</p>
        <img src="${prize.image}" alt="${prize.name}" style="max-width: 200px; margin: 10px 0;">
    `;
    const imageInput = form.querySelector('[name="image"]');
    imageInput.parentNode.insertBefore(currentImagePreview, imageInput);
}

// 添加删除奖品功能
function deletePrize(id) {
    const prize = prizes.find(p => p.id === id);
    if (!prize) return;

    if (confirm(`确定要删除奖品"${prize.name}"吗？`)) {
        prizes = prizes.filter(p => p.id !== id);
        savePrizesToStorage();
        loadPrizeData();
    }
}

// 修改关闭奖品模态框的函数
function closePrizeModal() {
    const modal = document.getElementById('prizeModal');
    modal.classList.remove('active');
    
    // 重置表单
    const form = document.getElementById('prizeForm');
    form.reset();
    delete form.dataset.mode;
    delete form.dataset.editId;
    
    // 移除当前图片预览
    const currentPreview = form.querySelector('.current-image-preview');
    if (currentPreview) {
        currentPreview.remove();
    }
    
    // 重置模态框标题
    modal.querySelector('.modal-header h3').textContent = '添加奖品';
}

// 修改奖品表单提交处理
document.getElementById('prizeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const isEdit = this.dataset.mode === 'edit';
    
    try {
        const count = parseInt(formData.get('count'));
        if (isNaN(count) || count < 0) {
            alert('请输入有效的奖品数量');
            return;
        }

        if (isEdit) {
            const originalPrize = prizes.find(p => p.id === parseInt(this.dataset.editId));
            if (!originalPrize) return;

            // 计算已使用的数量
            const used = originalPrize.initialCount - originalPrize.count;
            
            // 新的总数不能小于已使用数量
            if (count < used) {
                alert(`该奖品已使用 ${used} 个，新的总数量不能小于已使用数量`);
                return;
            }

            // 设置新的总数和剩余数
            const newInitialCount = count;
            const newCount = count - used;

            const prizeData = {
                id: parseInt(this.dataset.editId),
                name: formData.get('name'),
                description: formData.get('description'),
                count: newCount,
                initialCount: newInitialCount
            };

            // 处理图片
            const file = formData.get('image');
            if (file && file.size > 0) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('图片大小不能超过5MB');
                    return;
                }
                prizeData.image = await readFileAsDataURL(file);
            } else {
                prizeData.image = originalPrize.image;
            }

            // 更新奖品数据
            prizes = prizes.map(p => p.id === prizeData.id ? {
                ...p,
                ...prizeData
            } : p);

        } else {
            // 添加新奖品
            const prizeData = {
                id: Date.now(),
                name: formData.get('name'),
                description: formData.get('description'),
                count: count,
                initialCount: count
            };

            const file = formData.get('image');
            if (file && file.size > 0) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('图片大小不能超过5MB');
                    return;
                }
                prizeData.image = await readFileAsDataURL(file);
            } else {
                alert('请选择奖品图片');
                return;
            }

            prizes.push(prizeData);
        }

        savePrizesToStorage();
        loadPrizeData();
        closePrizeModal();
    } catch (error) {
        alert('处理奖品数据时出错: ' + error.message);
    }
});

// 辅助函数：读取文件为DataURL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });
}

// 添加显示奖品模态框的函数
function showAddPrizeModal() {
    const modal = document.getElementById('prizeModal');
    if (modal) {
        modal.classList.add('active');
        // 确保标题是"添加奖品"
        modal.querySelector('.modal-header h3').textContent = '添加奖品';
        // 重置表单
        document.getElementById('prizeForm').reset();
    }
}

// 添加用户表单提交处理
document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(this);
        const file = formData.get('image');
        
        if (!file || file.size === 0) {
            alert('请选择用户图片');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        // 读取图片为 DataURL
        const imageDataUrl = await readFileAsDataURL(file);
        
        // 创建新用户对象
        const newUser = {
            id: Date.now() + Math.random(), // 确保ID唯一
            name: formData.get('name'),
            image: imageDataUrl,
            registerTime: new Date().toLocaleString()
        };
        
        // 从 IndexedDB 获取现有用户列表
        const users = await loadFromDB('users') || [];
        
        // 添加新用户到列表开头
        users.unshift(newUser);
        
        // 保存更新后的用户列表到 IndexedDB
        await saveToDB('users', users);
        
        // 更新界面
        await loadUserData(currentPage);
        
        // 关闭模态框并重置表单
        closeUserModal();
        
    } catch (error) {
        console.error('添加用户失败:', error);
        alert('添加用户时出错: ' + error.message);
    }
});

// 添加背景图片管理相关函数
async function initializeSystemSettings() {
    try {
        const settings = await loadFromDB('settings') || [];
        const backgroundSetting = settings.find(s => s.id === 'background');
        const currentBackgroundImg = document.getElementById('currentBackground');
        
        if (backgroundSetting && backgroundSetting.value) {
            currentBackgroundImg.src = backgroundSetting.value;
            currentBackgroundImg.style.display = 'block';
        } else {
            // 如果没有背景设置，显示默认状态
            currentBackgroundImg.style.display = 'none';
            const previewContainer = currentBackgroundImg.parentElement;
            if (previewContainer) {
                previewContainer.style.background = '#f5f5f5';
                previewContainer.innerHTML += '<div class="no-background-text">暂无背景图片</div>';
            }
        }
    } catch (error) {
        console.error('加载系统设置失败:', error);
        // 显示错误状态
        const currentBackgroundImg = document.getElementById('currentBackground');
        if (currentBackgroundImg) {
            currentBackgroundImg.style.display = 'none';
            const previewContainer = currentBackgroundImg.parentElement;
            if (previewContainer) {
                previewContainer.style.background = '#fff0f0';
                previewContainer.innerHTML = '<div class="error-text">加载背景图片失败</div>';
            }
        }
    }
}

// 处理背景图片上传
document.getElementById('backgroundUpload')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        // 检查文件大小（限制为 2MB）
        if (file.size > 2 * 1024 * 1024) {
            alert('图片大小不能超过2MB');
            return;
        }
        
        // 读取文件为 DataURL
        const imageDataUrl = await readFileAsDataURL(file);
        
        // 保存到 IndexedDB
        const settings = await loadFromDB('settings') || [];
        const backgroundSetting = {
            id: 'background',
            value: imageDataUrl,
            updateTime: new Date().toISOString()
        };
        
        const updatedSettings = settings.filter(s => s.id !== 'background');
        updatedSettings.push(backgroundSetting);
        
        await saveToDB('settings', updatedSettings);
        
        // 更新预览
        const currentBackgroundImg = document.getElementById('currentBackground');
        const previewContainer = currentBackgroundImg.parentElement;
        
        // 清除可能存在的提示文本
        const textElements = previewContainer.querySelectorAll('.no-background-text, .error-text');
        textElements.forEach(el => el.remove());
        
        currentBackgroundImg.src = imageDataUrl;
        currentBackgroundImg.style.display = 'block';
        
        alert('背景图片更新成功！');
    } catch (error) {
        console.error('更新背景图片失败:', error);
        alert('更新背景图片失败: ' + error.message);
    }
});

// 重置背景图片
document.getElementById('resetBackground')?.addEventListener('click', async function() {
    if (confirm('确定要恢复默认背景吗？')) {
        try {
            const settings = await loadFromDB('settings') || [];
            const updatedSettings = settings.filter(s => s.id !== 'background');
            await saveToDB('settings', updatedSettings);
            
            const currentBackgroundImg = document.getElementById('currentBackground');
            currentBackgroundImg.style.display = 'none';
            
            const previewContainer = currentBackgroundImg.parentElement;
            previewContainer.style.background = '#f5f5f5';
            previewContainer.innerHTML = '<div class="no-background-text">暂无背景图片</div>';
            
            alert('已恢复默认背景！');
        } catch (error) {
            console.error('重置背景失败:', error);
            alert('重置背景失败: ' + error.message);
        }
    }
});

// 添加编辑用户相关函数
function showEditUserModal(userId) {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    
    // 从用户列表中找到对应用户
    loadFromDB('users').then(users => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        // 填充表单数据
        form.querySelector('[name="userId"]').value = user.id;
        form.querySelector('[name="name"]').value = user.name;
        document.getElementById('currentUserImage').src = user.image;
        
        // 显示模态框
        modal.classList.add('active');
    }).catch(error => {
        console.error('加载用户数据失败:', error);
        alert('加载用户数据失败: ' + error.message);
    });
}

// 关闭编辑用户模态框
function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    modal.classList.remove('active');
    form.reset();
}

// 处理编辑用户表单提交
document.getElementById('editUserForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const formData = new FormData(this);
        const userId = formData.get('userId');
        const newName = formData.get('name');
        const newImageFile = formData.get('newImage');
        
        // 获取当前用户列表
        const users = await loadFromDB('users') || [];
        const userIndex = users.findIndex(u => u.id === Number(userId));
        
        if (userIndex === -1) {
            throw new Error('用户不存在');
        }
        
        // 准备更新的用户数据
        const updatedUser = { ...users[userIndex] };
        updatedUser.name = newName;
        
        // 如果上传了新图片，处理图片
        if (newImageFile && newImageFile.size > 0) {
            if (newImageFile.size > 5 * 1024 * 1024) {
                alert('图片大小不能超过5MB');
                return;
            }
            updatedUser.image = await readFileAsDataURL(newImageFile);
        }
        
        // 更新用户列表
        users[userIndex] = updatedUser;
        await saveToDB('users', users);
        
        // 更新界面
        await loadUserData(currentPage);
        
        // 关闭模态框
        closeEditUserModal();
        
        alert('用户信息更新成功！');
    } catch (error) {
        console.error('更新用户失败:', error);
        alert('更新用户失败: ' + error.message);
    }
});

// 修改用户表格的操作列渲染
function updateUserTableRow(user) {
    return `
        <td>
            <div class="action-buttons">
                <button class="tool-button edit-user-btn" onclick="showEditUserModal(${user.id})" title="编辑用户">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="tool-button" onclick="deleteUser(${user.id})" title="删除用户">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
}

// 修改 loadUserData 函数中的表格渲染部分
async function loadUserData(page = 1, search = '') {
    try {
        users = await loadFromDB('users');
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        
        let filteredUsers = users.filter(user => 
            user.name.toLowerCase().includes(search.toLowerCase())
        );
        
        filteredUsers.sort((a, b) => {
            const aValue = a[currentSort.field];
            const bValue = b[currentSort.field];
            return currentSort.order === 'asc' 
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        });
        
        const pagedUsers = filteredUsers.slice(start, end);
        
        tbody.innerHTML = pagedUsers.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>
                    <img src="${user.image}" alt="${user.name}" 
                         style="width: 80px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                         onclick="showImagePreview('${user.image}')">
                </td>
                <td>${user.registerTime}</td>
                ${updateUserTableRow(user)}
            </tr>
        `).join('');
        
        updatePageInfo(filteredUsers.length, page);
        updatePagination(filteredUsers.length, page);
    } catch (error) {
        console.error('加载用户数据失败:', error);
        alert('加载用户数据时出错: ' + error.message);
    }
}

// 将编辑相关函数添加到window对象
window.showEditUserModal = showEditUserModal;
window.closeEditUserModal = closeEditUserModal;

// 修改初始化事件监听器
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        initializeTabs();
        initializeEventListeners();
        await loadUserData();
        await loadPrizeData();
        await loadRecordData();
        await initializeSystemSettings();
    } catch (error) {
        console.error('初始化失败:', error);
        alert('初始化数据时出错: ' + error.message);
    }
});

// 将需要在HTML中使用的函数添加到window对象
window.showImagePreview = showImagePreview;
window.deleteUser = deleteUser;
window.showAddUserModal = showAddUserModal;
window.closeUserModal = closeUserModal;
window.loadUserData = loadUserData;
window.editPrize = editPrize;
window.deletePrize = deletePrize;
window.closePrizeModal = closePrizeModal;
window.savePrizesToStorage = savePrizesToStorage;
window.showAddPrizeModal = showAddPrizeModal; 