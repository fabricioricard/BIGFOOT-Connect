export function initUpdateNotifications() {
  const notificationContainer = createNotificationContainer();
  document.body.appendChild(notificationContainer);
  
  if (window.electronAPI?.onUpdateNotification) {
    window.electronAPI.onUpdateNotification((data) => {
      console.log('[UPDATE UI] Notification received:', data);
      
      if (data.type === 'available') {
        showUpdateAvailable(data, notificationContainer);
      } else if (data.type === 'downloaded') {
        showUpdateReady(data, notificationContainer);
      } else if (data.type === 'error') {
        showUpdateError(data, notificationContainer);
      }
    });
  }
  
  if (window.electronAPI?.onUpdateProgress) {
    window.electronAPI.onUpdateProgress((progress) => {
      updateProgressBar(progress);
    });
  }
  
  console.log('[UPDATE UI] Update notifications initialized');
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'update-notifications';
  return container;
}

function showUpdateAvailable(data, container) {
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-icon">🔄</div>
    <div class="update-content">
      <h3>Update Available</h3>
      <p>Version ${data.version} is being downloaded...</p>
      ${data.message ? `<p class="update-message">${data.message}</p>` : ''}
      <div class="update-progress-container">
        <div class="update-progress-bar" id="updateProgressBar">
          <div class="update-progress-fill" id="updateProgressFill"></div>
        </div>
        <span class="update-progress-text" id="updateProgressText">0%</span>
      </div>
    </div>
  `;
  
  container.innerHTML = '';
  container.appendChild(notification);
}

function showUpdateReady(data, container) {
  const notification = document.createElement('div');
  notification.className = 'update-notification update-ready';
  notification.innerHTML = `
    <div class="update-icon">✅</div>
    <div class="update-content">
      <h3>Update Ready</h3>
      <p>Version ${data.version} has been downloaded</p>
      ${data.message ? `<p class="update-message">${data.message}</p>` : ''}
      <div class="update-buttons">
        <button class="update-btn update-btn-primary" id="installUpdateBtn">
          🚀 Install Now
        </button>
        <button class="update-btn update-btn-secondary" id="postponeUpdateBtn">
          ⏰ Later
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = '';
  container.appendChild(notification);
  
  // Event listeners
  const installBtn = document.getElementById('installUpdateBtn');
  const postponeBtn = document.getElementById('postponeUpdateBtn');
  
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      console.log('[UPDATE UI] User clicked Install Now');
      installBtn.disabled = true;
      installBtn.textContent = '⏳ Installing...';
      
      if (window.electronAPI?.installUpdate) {
        await window.electronAPI.installUpdate();
      }
    });
  }
  
  if (postponeBtn) {
    postponeBtn.addEventListener('click', async () => {
      console.log('[UPDATE UI] User clicked Later');
      
      if (window.electronAPI?.postponeUpdate) {
        await window.electronAPI.postponeUpdate();
        
        // Remove notification with animation
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(120%)';
        
        setTimeout(() => {
          notification.remove();
        }, 400);
      }
    });
  }
}

function showUpdateError(data, container) {
  const notification = document.createElement('div');
  notification.className = 'update-notification update-error';
  notification.innerHTML = `
    <div class="update-icon">❌</div>
    <div class="update-content">
      <h3>Update Error</h3>
      <p>Failed to download update</p>
      ${data.message ? `<p class="update-message">${data.message}</p>` : ''}
      <button class="update-btn update-btn-secondary" id="dismissErrorBtn">
        Dismiss
      </button>
    </div>
  `;
  
  container.innerHTML = '';
  container.appendChild(notification);
  
  // Event listener para fechar erro
  const dismissBtn = document.getElementById('dismissErrorBtn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(120%)';
      
      setTimeout(() => {
        notification.remove();
      }, 400);
    });
  }
  
  // Auto-dismiss após 10 segundos
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(120%)';
      
      setTimeout(() => {
        notification.remove();
      }, 400);
    }
  }, 10000);
}

function updateProgressBar(progress) {
  const progressFill = document.getElementById('updateProgressFill');
  const progressText = document.getElementById('updateProgressText');
  
  if (progressFill) {
    progressFill.style.width = `${progress.percent}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${progress.percent}%`;
  }
  
  console.log(`[UPDATE UI] Progress: ${progress.percent}%`);
}