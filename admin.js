// 在文件开头添加变量声明
let users = JSON.parse(localStorage.getItem('users')) || [];
let prizes = JSON.parse(localStorage.getItem('prizes')) || [];
let currentSort = {
    field: 'registerTime',
    order: 'desc'
};
let pageSize = 10;
let currentPage = 1;

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

// 保存用户数据到localStorage
function saveUsersToStorage() {
    try {
        localStorage.setItem('users', JSON.stringify(users));
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            alert('存储空间不足，请清理一些数据后重试');
        } else {
            alert('保存数据时出错: ' + error.message);
        }
        throw error;
    }
}

// 加载奖品数据
function loadPrizeData() {
    const grid = document.getElementById('prizeGrid');
    if (!grid) return;

    const currentPrizes = prizes || [];
    grid.innerHTML = currentPrizes.length > 0 
        ? currentPrizes.map(prize => `
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
}

// 加载抽奖记录
function loadRecordData() {
    const records = JSON.parse(localStorage.getItem('records')) || [];
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

// 添加 loadUserData 函数
function loadUserData(page = 1, search = '') {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return; // 如果找不到表格体，直接返回

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

// 添加保存奖品数据到localStorage的函数
function savePrizesToStorage() {
    try {
        localStorage.setItem('prizes', JSON.stringify(prizes));
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            alert('存储空间不足，请清理一些数据后重试');
        } else {
            alert('保存数据时出错: ' + error.message);
        }
        throw error;
    }
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

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeEventListeners();
    loadUserData();
    loadPrizeData();
    loadRecordData();
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