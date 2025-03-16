document.addEventListener('DOMContentLoaded', function() {
  // Tab switching functionality
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to current tab and content
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      
      // Hide results when switching tabs
      document.getElementById('result').style.display = 'none';
    });
  });
  
  // Add explanation item functionality
  const addExplanationItemBtn = document.getElementById('addExplanationItem');
  const explanationItems = document.getElementById('explanationItems');
  
  let itemCount = 1;
  
  addExplanationItemBtn.addEventListener('click', () => {
    itemCount++;
    
    // Create Chinese numeral representation
    const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    let itemNumber = '';
    
    if (itemCount <= 10) {
      itemNumber = chineseNumerals[itemCount - 1];
    } else if (itemCount > 10 && itemCount <= 19) {
      itemNumber = '十' + (itemCount > 10 ? chineseNumerals[itemCount - 11] : '');
    } else {
      itemNumber = chineseNumerals[Math.floor(itemCount / 10) - 1] + '十' + (itemCount % 10 > 0 ? chineseNumerals[itemCount % 10 - 1] : '');
    }
    
    const newItem = document.createElement('div');
    newItem.className = 'explanation-item';
    newItem.innerHTML = `
      <div class="item-number">${itemNumber}、</div>
      <textarea class="item-content" rows="2" placeholder="請輸入說明內容..."></textarea>
    `;
    
    explanationItems.appendChild(newItem);
  });
  
  // Add attachment functionality
  const addAttachmentBtn = document.getElementById('addAttachmentBtn');
  const attachmentInputs = document.getElementById('attachmentInputs');
  
  let attachmentCount = 1;
  
  addAttachmentBtn.addEventListener('click', () => {
    attachmentCount++;
    
    const newAttachment = document.createElement('div');
    newAttachment.className = 'attachment-input';
    newAttachment.innerHTML = `
      <label for="pdfAttachment${attachmentCount}">附件 ${attachmentCount}:</label>
      <input type="file" id="pdfAttachment${attachmentCount}" name="pdfAttachment${attachmentCount}" accept=".pdf" class="pdf-attachment">
    `;
    
    attachmentInputs.appendChild(newAttachment);
  });
  
  // Generate Files from Template Form
  const generateBtn = document.getElementById('generateBtn');
  generateBtn.addEventListener('click', async function() {
    // Show result container
    const resultContainer = document.getElementById('result');
    resultContainer.style.display = 'block';
    
    const processingStatus = document.getElementById('processingStatus');
    processingStatus.innerHTML = '<div class="loading"></div> 處理中，請稍候... (Processing, please wait...)';
    
    // Get form data
    const formData = new FormData();
    
    // Basic document info
    formData.append('orgName', document.getElementById('orgName').value);
    formData.append('address', document.getElementById('address').value);
    formData.append('contact', document.getElementById('contact').value);
    formData.append('contactMethod', document.getElementById('contactMethod').value);
    formData.append('fax', document.getElementById('fax').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('recipient', document.getElementById('recipient').value);
    formData.append('documentDate', document.getElementById('documentDate').value);
    
    // Document number
    const documentPrefix = document.getElementById('documentPrefix').value;
    const documentNumber = document.getElementById('documentNumber').value;
    formData.append('documentNumber', `${documentPrefix}字第${documentNumber}號`);
    
    // Other document metadata
    formData.append('priority', document.getElementById('priority').value);
    formData.append('securityLevel', document.getElementById('securityLevel').value);
    formData.append('attachment', document.getElementById('attachment').value);
    formData.append('subject', document.getElementById('subject').value);
    
    // Explanation items
    const explanationItems = document.querySelectorAll('.explanation-item');
    const explanations = [];
    
    explanationItems.forEach((item) => {
      const number = item.querySelector('.item-number').textContent;
      const content = item.querySelector('.item-content').value;
      explanations.push(`${number}${content}`);
    });
    
    formData.append('explanation', JSON.stringify(explanations));
    
    // Recipients
    formData.append('primaryRecipient', document.getElementById('primaryRecipient').value);
    formData.append('copyRecipient', document.getElementById('copyRecipient').value);
    
    // Signature
    formData.append('signerTitle', document.getElementById('signerTitle').value);
    formData.append('signerName', document.getElementById('signerName').value);
    
    // PDF attachments (if provided)
    const pdfAttachments = document.querySelectorAll('.pdf-attachment');
    let attachmentCount = 0;
    
    pdfAttachments.forEach((input, index) => {
      if (input.files && input.files[0]) {
        formData.append(`pdfAttachment${index + 1}`, input.files[0]);
        attachmentCount++;
      }
    });
    
    formData.append('attachmentCount', attachmentCount);
    
    try {
      const response = await fetch('/generate', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      displayDownloadLinks(data);
    } catch (error) {
      processingStatus.innerHTML = `<p style="color: red;">錯誤: ${error.message} (Error: ${error.message})</p>`;
    }
  });
  
  // Convert PDF Form
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.addEventListener('click', async function() {
    const pdfFile = document.getElementById('pdfFile').files[0];
    
    if (!pdfFile) {
      alert('請選擇一個 PDF 檔案 (Please select a PDF file)');
      return;
    }
    
    // Show result container
    const resultContainer = document.getElementById('result');
    resultContainer.style.display = 'block';
    
    const processingStatus = document.getElementById('processingStatus');
    processingStatus.innerHTML = '<div class="loading"></div> 處理中，請稍候... (Processing, please wait...)';
    
    const formData = new FormData();
    formData.append('pdfFile', pdfFile);
    
    try {
      const response = await fetch('/convert', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      displayDownloadLinks(data);
    } catch (error) {
      processingStatus.innerHTML = `<p style="color: red;">錯誤: ${error.message} (Error: ${error.message})</p>`;
    }
  });
  
  // Helper function to display download links
  function displayDownloadLinks(data) {
    const processingStatus = document.getElementById('processingStatus');
    const downloadLinks = document.getElementById('downloadLinks');
    
    processingStatus.innerHTML = '<p style="color: green;">轉換成功! (Conversion successful!)</p>';
    
    let linksHTML = `
      <a href="${data.files.di}" class="download-btn" download>下載 DI 檔案 (Download DI file)</a>
      <a href="${data.files.sw}" class="download-btn" download>下載 SW 檔案 (Download SW file)</a>
    `;
    
    // Add attachment download links if they exist
    if (data.files.attachments && data.files.attachments.length > 0) {
      data.files.attachments.forEach(attachment => {
        linksHTML += `<a href="${attachment.path}" class="download-btn" download>下載 ${attachment.name} (Download ${attachment.name})</a>`;
      });
    } else if (data.files.pdf) {
      // Support for old format response
      linksHTML += `<a href="${data.files.pdf}" class="download-btn" download>下載 PDF 檔案 (Download PDF file)</a>`;
    }
    
    // Add ZIP download link
    linksHTML += `<a href="${data.files.zip}" class="download-btn" download>下載 ZIP 包 (Download ZIP package)</a>`;
    
    downloadLinks.innerHTML = linksHTML;
  }
});