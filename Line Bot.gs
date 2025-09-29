/********************************************************************************
 * ส่วนที่ต้องแก้ไขค่า (CONFIGURATION)
 ********************************************************************************/
var SPREADSHEET_ID = 'xxxxxxxxxxxx'; // <<<< กรุณาตรวจสอบว่าเป็น ID ของชีตที่ถูกต้อง

/********************************************************************************
 * ค่าคงที่ของ LINE API (CONSTANTS)
 ********************************************************************************/
var REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
var PUSH_URL = 'https://api.line.me/v2/bot/message/push';
var PROFILE_URL = 'https://api.line.me/v2/bot/profile/';
var LOADING_URL = 'https://api.line.me/v2/bot/chat/loading/start';
var IMAGE_CONTENT_URL = 'https://api-data.line.me/v2/bot/message/';

/********************************************************************************
 * ฟังก์ชันสร้างเมนูใน Google Sheet
 ********************************************************************************/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤖 Bot Control')
    .addItem('🔄 อัปเดตค่าตั้งค่าทันที', 'clearSettingsCache')
    .addToUi();
}

function clearSettingsCache() {
  try {
    CacheService.getScriptCache().remove('bot_settings');
    Logger.log('Settings cache cleared manually.');
    SpreadsheetApp.getUi().alert('สำเร็จ!', 'Cache การตั้งค่าถูกล้างแล้ว บอทจะใช้ข้อมูลใหม่จากชีต "Setting" ทันทีในการทำงานครั้งต่อไป', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('เกิดข้อผิดพลาด', 'ไม่สามารถล้าง Cache ได้: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/********************************************************************************
 * ฟังก์ชันดึงค่าตั้งค่าจากชีต Setting
 ********************************************************************************/
function getSettings() {
  var cache = CacheService.getScriptCache();
  var cachedSettings = cache.get('bot_settings');
  if (cachedSettings != null) {
    return JSON.parse(cachedSettings);
  }

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Setting');
    if (!sheet) {
      Logger.log('CRITICAL ERROR: "Setting" sheet not found.');
      return null;
    }
    var data = sheet.getRange(2, 1, 1, 11).getValues()[0];
    if (!data[0] || data[0] === 'ใส่ Access Token ที่นี่') {
      Logger.log('CRITICAL ERROR: Access Token is missing in the "Setting" sheet.');
      return null;
    }
    var settings = {
      accessToken: data[0],
      sheetId: data[1],
      folderId: data[2],
      promptPayId: data[3] ? data[3].toString().trim() : '',
      qrWalletUrl: data[4],
      trueMoneyNumber: data[5] ? data[5].toString().trim() : '',
      botConnect: { name: data[6], iconUrl: data[7] },
      payConnect: { name: data[8], iconUrl: data[9] },
      urlAddress: data[10]
    };

    // [ปรับปรุง] ลดเวลา Cache เหลือ 30 วินาที เพื่อให้อัปเดตการตั้งค่าไวขึ้น
    cache.put('bot_settings', JSON.stringify(settings), 30); 
    return settings;
  } catch (e) {
    Logger.log('CRITICAL ERROR: Could not read "Setting" sheet. ' + e.stack);
    return null;
  }
}

/********************************************************************************
 * ฟังก์ชันสำหรับติดตั้งโปรเจคครั้งแรก (Initial Setup)
 ********************************************************************************/
function initialSetup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var accountBankSheet = ss.getSheetByName('Account Bank');
  if (accountBankSheet) {
    ss.deleteSheet(accountBankSheet);
  }

  var sheets = {
    'Shop': ['IDรหัสสินค้า', 'ชื่อสินค้า', 'ราคาสินค้า', 'ส่วนลด', 'ภาษี 7%', 'DownloadURL', 'ลิงค์รูปสินค้า1', 'จำนวนสินค้า'],
    'Orders': ['Date Time', 'OrderID', 'UserID', 'Display Name', 'Items JSON', 'ยอดรวมก่อนลด', 'ส่วนลดรวม', 'ภาษีรวม', 'ยอดสุทธิ', 'สถานะ', 'PaymentID'],
    'Receipts': ['Date Time', 'ReceiptID', 'OrderID', 'UserID', 'Display Name', 'Items JSON', 'ยอดรวมสุทธิ', 'ประเภทการชำระเงิน'],
    'Q&A': ['Keyword', 'Type', 'Content', 'Quick1', 'Quick2', 'Quick3', 'Quick4', 'Quick5', 'Quick6'],
    'New Friend': ['Keyword', 'Type', 'Content', 'Quick1', 'Quick2', 'Quick3', 'Quick4'],
    'Data': ['Timestamp', 'UserID', 'DisplayName', 'Status'],
    'Images': ['Timestamp', 'FileName', 'FileURL'],
    'Payments': ['Timestamp', 'UserID', 'DisplayName', 'Amount', 'Fee', 'Total', 'QRCodeURL', 'Status', 'PaymentType', 'Success', 'Unsuccess', 'PaymentID'],
    'Statement': ['Date', 'Times', 'UserID', 'Display Name', 'ธนาคาร', 'ชื่อรายการชำระ', 'รายการ', 'จำนวนเงิน', 'พ้อยท์คงเหลือ', 'ยอดรวมการชำระ'],
    'Setting': ['Access Token', 'Sheet ID', 'Folder ID', 'PromptPay ID', 'QR Wallet URL', 'TrueMoney Number', 'Bot Sender 1 Name', 'Bot Sender 1 URL', 'Bot Sender 2 Name', 'Bot Sender 2 URL', 'URL Address'],
    'ADMIN': ['Date', 'Time', 'UserID', 'DisplayName', 'Status', 'หมายเหตุ'],
    'ST Booking': ['Service', 'Working Days', 'Start Time', 'End Time'],
    'Booking': ['Timestamp', 'UserID', 'DisplayName', 'Phone', 'Service', 'BookingDateTime', 'Status', 'QueueNumber'],
    'Repairs': ['Timestamp', 'RepairID', 'UserID', 'DisplayName', 'AssetDetails', 'ProblemDescription', 'PhotoURL', 'Status', 'AdminNotes']
  };

  for (var name in sheets) {
    var existingSheet = ss.getSheetByName(name);
    if (existingSheet == null) {
      var newSheet = ss.insertSheet(name);
      newSheet.getRange(1, 1, 1, sheets[name].length).setValues([sheets[name]]);
    } else {
      var currentHeaders = existingSheet.getRange(1, 1, 1, existingSheet.getLastColumn()).getValues()[0];
      var newHeaders = sheets[name];
      if (currentHeaders.join() !== newHeaders.join()) {
        existingSheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
      }
    }
    if (name === 'Data' && existingSheet == null) {
      ss.getSheetByName(name).appendRow([new Date(), 'Uxxxxxxxx_SAMPLE_xxxxxxxx', 'SampleUser', '']);
    }

    if (name === 'New Friend' && existingSheet == null) {
      var newFriendSheet = ss.getSheetByName(name);
      newFriendSheet.appendRow([
        'Welcome', 'text', 'ขอบคุณที่เพิ่มเป็นเพื่อน! กรุณาเลือกเมนูที่ท่านสนใจด้านล่างได้เลยครับ',
        'Connect', 'Promotion', 'Booking Now', ''
      ]);
      newFriendSheet.getRange('A3').setValue('ใส่ Keyword "Welcome" เพื่อให้ระบบดึงข้อความนี้ไปใช้ทักทายเพื่อนใหม่');
    }
      if (name === 'ST Booking' && existingSheet == null) {
        var stBookingSheet = ss.getSheetByName(name);
        stBookingSheet.appendRow(['บริการฝากเงิน/ถอนเงิน', 'จ-อา', '10:00', '18:00']);
        stBookingSheet.appendRow(['บริการเปิดบัญชี', 'จ-ศ', '09:00', '16:00']);
    }

    if (name === 'Payments' || name === 'Shop') {
      var sheet = ss.getSheetByName(name);
      var checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      if (name === 'Payments') {
        sheet.getRange('J2:J').setDataValidation(checkboxRule);
        sheet.getRange('K2:K').setDataValidation(checkboxRule);
      }
      if (name === 'Shop') {
        sheet.getRange('E2:E').setDataValidation(checkboxRule);
      }
    }
    if (name === 'Setting' && existingSheet == null) {
      var settingSheet = ss.getSheetByName(name);
      settingSheet.appendRow([
        'ใส่ Access Token ที่นี่', SPREADSHEET_ID, 'ใส่ Folder ID ที่นี่',
        'ใส่ PromptPay ID ที่นี่', 'ใส่ QR Wallet URL ที่นี่', 'ใส่เบอร์ TrueMoney ที่นี่',
        'Bot Name 1', 'https://example.com/icon1.png', 'Bot Name 2',
        'https://example.com/icon2.png', 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform'
      ]);
      settingSheet.getRange('A3').setValue('กรุณากรอกข้อมูลในแถวที่ 2 นี้ให้เป็นข้อมูลจริงของคุณทั้งหมด');
    }
    if (name === 'Shop' && existingSheet == null) {
      ss.getSheetByName(name).appendRow(['PROD001', 'สินค้าตัวอย่าง 1', 1150, 100, true, '', 'https://i.ibb.co/xF7jTvc/sample1.png', 50]);
      ss.getSheetByName(name).appendRow(['PROD002', 'ไฟล์ดิจิทัล (มีปุ่มโหลด)', 3750, 0, false, 'https://www.google.com/', 'https://i.ibb.co/0r7TgMk/sample2.png', 99]);
      ss.getSheetByName(name).appendRow(['PROD003', 'สินค้าชิ้นที่ 3', 500, 50, true, '', 'https://i.ibb.co/Y2SpB0p/sample3.png', 20]);
    }
  }
  Logger.log('Setup Complete! สร้าง/อัปเดตชีตที่จำเป็นเรียบร้อยแล้ว');
  SpreadsheetApp.getActiveSpreadsheet().toast('การตั้งค่าเริ่มต้น (Setup) เสร็จสมบูรณ์', '✅ สำเร็จ', 5);
}


/********************************************************************************
* ทริกเกอร์สำหรับการแก้ไขชีต (On Edit)
********************************************************************************/
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  var row = range.getRow();
  var col = range.getColumn();
  var value = e.value;

  if (sheetName === 'Setting' && row === 2) {
    try {
      CacheService.getScriptCache().remove('bot_settings');
      Logger.log('Settings cache cleared automatically due to sheet edit.');
    } catch (err) {
      Logger.log('Failed to auto-clear settings cache: ' + err.message);
    }
    return;
  }

  if (sheetName === 'Payments') {
    if (row > 1 && (col === 10 || col === 11) && value === 'TRUE') {
      var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

      var currentStatus = rowData[7];
      if (currentStatus !== 'Generated') {
        Logger.log('Attempted to re-confirm an already processed payment (ID: ' + rowData[11] + '). Action blocked.');
        return;
      }

      var userId = rowData[1];
      var displayName = rowData[2];
      var amount = parseFloat(rowData[3]);
      var totalAmount = parseFloat(rowData[5]);
      var paymentType = rowData[8];
      var paymentId = rowData[11];

      if (userId) {
        var settings = getSettings();
        if (!settings) return;

        var isSuccess = (col === 10);
        if (isSuccess) {
          sheet.getRange(row, 11).uncheck();
          sheet.getRange(row, 8).setValue('Confirmed');
        } else {
          sheet.getRange(row, 10).uncheck();
          sheet.getRange(row, 8).setValue('Failed');
        }

        processSuccessfulPayment(paymentId, paymentType, userId, displayName, amount, totalAmount, isSuccess);
      }
    }
  }
}


/********************************************************************************
* ทริกเกอร์หลัก (MAIN TRIGGERS)
********************************************************************************/
function doPost(e) {
  try {
    var settings = getSettings();
    if (!settings) {
      Logger.log("Bot stopped because settings are not configured properly.");
      return;
    }

    var event = JSON.parse(e.postData.contents).events[0];

    if (event.type === 'follow') {
      handleFollowEvent(event);
      return;
    }

    if (event.type === 'message') {
      var userId = event.source.userId;
      showLoadingAnimation(userId, 5);
      var cache = CacheService.getScriptCache();
      if (event.message && event.message.id) {
        if (cache.get(event.message.id)) { return; }
        cache.put(event.message.id, 'processed', 600);
      }
      if (event.message.type === 'text') {
        handleTextMessage(event);
      } else if (event.message.type === 'image') {
        handleImageMessage(event);
      }
    }
  } catch (err) {
    Logger.log('Error in doPost: ' + err.stack);
  }
  return ContentService.createTextOutput(JSON.stringify({'status': 'ok'})).setMimeType(ContentService.MimeType.JSON);
}


/********************************************************************************
* ตัวจัดการ Event (EVENT HANDLERS)
********************************************************************************/
function handleFollowEvent(event) {
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('New Friend');
    if (!sheet || sheet.getLastRow() < 2) {
        var welcomeMessage = { type: 'text', text: 'ขอบคุณที่เพิ่มเราเป็นเพื่อน!' };
        reply(replyToken, [welcomeMessage], settings.botConnect);
        return;
    }

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var responseData = null;
    for (var i = 0; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toLowerCase() === 'welcome') {
            responseData = data[i];
            break;
        }
    }

    if (!responseData && data.length > 0) {
        responseData = data[0];
    }

    if (responseData) {
        var messages = buildReplyMessages(responseData);
        reply(replyToken, messages, settings.botConnect);
    } else {
        var defaultMessage = { type: 'text', text: 'ยินดีต้อนรับค่ะ!' };
        reply(replyToken, [defaultMessage], settings.botConnect);
    }
  } catch(e) {
      Logger.log("Error in handleFollowEvent: " + e.stack);
      var errorMessage = { type: 'text', text: 'สวัสดีค่ะ! ยินดีต้อนรับนะคะ' };
      reply(replyToken, [errorMessage], settings.botConnect);
  }
}

function handleTextMessage(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var userMessage = event.message.text.trim();
  var userMessageLower = userMessage.toLowerCase();
  var settings = getSettings();
  if (!settings) return;
  var userProfile = getProfile(userId);
  logNewUser(userId, userProfile.displayName);
  var cache = CacheService.getScriptCache();

  // --- [START] Admin Dashboard Flow ---
  var adminKeywords = ['ตรวจสอบข้อมูล', 'ข้อมูลรายการ', 'แดชบอร์ด', 'admin information'];
  if (adminKeywords.includes(userMessageLower)) {
    var admins = getAdmins();
    if (admins.includes(userId)) {
      handleAdminDashboardRequest(event);
      return;
    }
  }
  // --- [END] Admin Dashboard Flow ---

  // --- [START] Admin Action Handlers ---
  if (userMessage.startsWith('ADMIN_CHECK_PAYMENTID_')) {
    handleAdminPendingClick(event);
    return;
  }
  if (userMessage.startsWith('ADMIN_CALL_QUEUE_')) {
    handleAdminCallQueue(event);
    return;
  }
  // --- [END] Admin Action Handlers ---

  if (userMessageLower === 'ยกเลิก' || userMessageLower === 'cancel') {
    handleCancellation(event);
    return;
  }

  // --- [START] Repair Flow ---
  var repairState = cache.get('repair_state_' + userId);
  if (repairState) {
    handleRepairState(event, repairState);
    return;
  }
  if (['แจ้งซ่อม', 'repair'].includes(userMessageLower)) {
    startRepairFlow(event);
    return;
  }
  // --- [END] Repair Flow ---
  
  // --- [START] Booking Flow ---
  var bookingState = cache.get('booking_state_' + userId);
  if (bookingState) {
    handleBookingState(event, bookingState);
    return;
  }
  if (['จองคิว', 'booking', 'booking now'].includes(userMessageLower)) {
    startBookingFlow(event);
    return;
  }
  // --- [END] Booking Flow ---

  // --- [START] Queue Check Flow ---
  if (['ตรวจสอบคิว', 'queue me', 'คิวของฉัน', 'ข้อมูลการจอง'].includes(userMessageLower)) {
      handleQueueCheckRequest(event);
      return;
  }
  if (userMessageLower === 'ดูคิวทั้งหมด') {
    handleViewAllQueuesRequest(event);
    return;
  }
  // --- [END] Queue Check Flow ---

  var myOrdersKeywords = ['สินค้าจองฉัน', 'ประวัติการสั่งซื้อ', 'my orders'];
  if (myOrdersKeywords.includes(userMessageLower)) {
    handleMyOrdersRequest(event);
    return;
  }

  var shopKeywords = ['shop', 'store', 'ร้านค้า', 'menu : shop'];
  if (shopKeywords.includes(userMessageLower)) {
    cache.put('user_flow_' + userId, 'shopping', 1800);
    handleShopRequest(event);
    return;
  }

  var paymentRegex = /^(?:ชำระ|payment|pay|จ่าย)\s*([0-9,.]+)/i;
  var paymentMatch = userMessage.match(paymentRegex);
  if (paymentMatch) {
    var amount = parseFloat(paymentMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount >= 1 && amount <= 50000) {
      routePaymentFlow(event, amount);
    } else {
      reply(replyToken, [{ type: 'text', text: 'ขออภัยค่ะ ยอดชำระต้องอยู่ระหว่าง 1 - 50,000 บาท\nกรุณาลองใหม่อีกครั้งค่ะ' }], settings.payConnect);
    }
    return;
  }

  var paymentKeywords = ['payment', 'ชำระเงิน', 'menu : payment', 'pay'];
  if (paymentKeywords.includes(userMessageLower)) {
    startPaymentFlow(event);
    return;
  }

  if (userMessageLower === 'statement') {
    handleStatementRequest(event);
    return;
  }

  var paymentState = cache.get('payment_state_' + userId);
  if (paymentState) {
    handlePaymentState(event, paymentState);
    return;
  }

  if (userMessage.startsWith('PromptPay') || userMessage.startsWith('TrueMoney')) { processPaymentSelection(event); return; }
  if (userMessageLower === 'สถานะการชำระ') { handlePaymentStatusRequest(event); return; }
  if (userMessage.startsWith('ADD_TO_CART_')) { handleAddToCart(event); return; }
  if (userMessageLower === 'cart' || userMessageLower === 'รถเข็น' || userMessageLower === 'ตะกร้า') { handleViewCart(event); return; }
  if (userMessage.startsWith('Payment : Shop_')) { handleShopPaymentRequest(event); return; }
  if (userMessageLower === 'ใบเสร็จ' || userMessageLower === 'receipt' || userMessage === 'Shop :Receipt') { handleReceiptRequest(event); return; }
  if (userMessage.startsWith('CONFIRM ') || userMessage.startsWith('CANCEL PAY ')) { handleAdminConfirmation(event); return; }
  if (['สมัคร', 'connect'].includes(userMessageLower)) { handleConnectRequest(event); return; }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var responseData = findInSheet(ss.getSheetByName('Q&A'), userMessage);
  if (responseData) {
    var answerMessages = buildReplyMessages(responseData);
    reply(replyToken, answerMessages, settings.botConnect);
  }
}
/********************************************************************************
* E-COMMERCE / SHOPPING FUNCTIONS
********************************************************************************/
function handleShopRequest(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  showLoadingAnimation(userId, 5);

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Shop');
    if (!sheet || sheet.getLastRow() < 2) {
      reply(replyToken, [{ type: 'text', text: 'ขออภัยค่ะ ขณะนี้ยังไม่มีสินค้าในร้านค้า' }], settings.botConnect);
      return;
    }
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    var products = data.map(function(row) {
      if (!row[0] || !row[1]) return null;
      var imageUrl = row[6] && row[6].trim() !== '' ? row[6] : "https://via.placeholder.com/600x400.png?text=No+Image";
      var quantity = parseInt(row[7], 10);
      return { id: row[0], name: row[1], price: parseFloat(row[2]), discount: parseFloat(row[3] || 0), taxable: row[4], downloadUrl: row[5], imageUrl: imageUrl, quantity: isNaN(quantity) ? 0 : quantity };
    }).filter(function(p) { return p && p.quantity > 0; });

    if (products.length === 0) {
      reply(replyToken, [{ type: 'text', text: 'ขออภัยค่ะ ขณะนี้สินค้าหมดสต็อกทั้งหมด' }], settings.botConnect);
      return;
    }
    var flexMessage = generateShopListFlex(products);
    reply(replyToken, [flexMessage], settings.botConnect);
  } catch (e) {
    Logger.log('Error in handleShopRequest: ' + e.stack);
    reply(replyToken, [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าค่ะ' }], settings.botConnect);
  }
}

function handleAddToCart(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var productId = event.message.text.substring('ADD_TO_CART_'.length);
    var settings = getSettings();
    if (!settings) return;

    var product = findProductById(productId);
    if (!product) {
        reply(replyToken, [{ type: 'text', text: 'ขออภัย ไม่พบสินค้านี้ในระบบ' }], settings.botConnect);
        return;
    }

    var cache = CacheService.getScriptCache();
    var cartJson = cache.get('cart_' + userId);
    var cart = cartJson ? JSON.parse(cartJson) : [];
    var existingItem = cart.find(function(item) { return item.id === productId; });

    var quantityInCart = existingItem ? existingItem.quantity : 0;
    if (product.quantity <= quantityInCart) {
        reply(replyToken, [{ type: 'text', text: 'ขออภัยค่ะ "' + product.name + '" มีสินค้าในสต็อกไม่เพียงพอ' }], settings.botConnect);
        return;
    }

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, discount: product.discount, taxable: product.taxable, downloadUrl: product.downloadUrl, imageUrl: product.imageUrl, quantity: 1 });
    }

    cache.put('cart_' + userId, JSON.stringify(cart), 1800);
    var totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
    var totalPrice = calculateCartTotals(cart).grandTotal;

    var replyText = '✅ เพิ่ม "' + product.name + '" ลงในตะกร้าแล้วค่ะ\n\n' + '🛒 ตอนนี้ในตะกร้ามี ' + totalItems + ' ชิ้น\n' + '💰 ยอดรวมประมาณ ' + totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' บาท';

    var quickReply = { items: [ { type: 'action', imageUrl: 'https://cdn.dribbble.com/userupload/23891670/file/original-7756b31ec0286d49dd2fa07ab32bb664.gif', action: { type: 'message', label: 'ดูรถเข็น', text: 'cart' } }, { type: 'action', imageUrl: 'https://cdn-icons-gif.flaticon.com/11679/11679351.gif', action: { type: 'message', label: 'เลือกซื้อต่อ', text: 'shop' } } ] };

    reply(replyToken, [{ type: 'text', text: replyText, quickReply: quickReply }], settings.botConnect);
}


function handleViewCart(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;

  var cache = CacheService.getScriptCache();
  var cartJson = cache.get('cart_' + userId);
  var cart = cartJson ? JSON.parse(cartJson) : [];

  if (cart.length === 0) {
    clearAllCache(userId);
    reply(replyToken, [{ type: 'text', text: '🛒 ตะกร้าสินค้าของคุณว่างอยู่ค่ะ\nลองพิมพ์ "shop" เพื่อเลือกซื้อสินค้าได้เลยค่ะ' }], settings.botConnect);
    return;
  }
  var orderId = 'ORD' + new Date().getTime();
  cache.put('orderId_' + userId, orderId, 300);
  var flexMessage = generateCartFlex(cart, orderId);
  reply(replyToken, [flexMessage], settings.botConnect);
}

function handleShopPaymentRequest(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var messageText = event.message.text;
  var settings = getSettings();
  if (!settings) return;
  showLoadingAnimation(userId, 5);
  var incomingOrderId = messageText.substring('Payment : Shop_'.length);

  var cache = CacheService.getScriptCache();
  var expectedOrderId = cache.get('orderId_' + userId);

  if (!expectedOrderId || incomingOrderId !== expectedOrderId) {
    reply(replyToken, [{ type: 'text', text: 'รายการสั่งซื้อหมดอายุหรือไม่ถูกต้อง กรุณาดูรถเข็นแล้วลองใหม่อีกครั้ง' }], settings.botConnect);
    return;
  }
  var cartJson = cache.get('cart_' + userId);
  var cart = cartJson ? JSON.parse(cartJson) : [];

  if (cart.length === 0) {
    reply(replyToken, [{ type: 'text', text: 'ตะกร้าสินค้าของคุณว่างเปล่า' }], settings.botConnect);
    return;
  }
  var totals = calculateCartTotals(cart);
  var userProfile = getProfile(userId);
  var paymentId = 'SHOP' + Math.floor(1000000 + Math.random() * 9000000);
  logToSheet('Orders', [ new Date(), expectedOrderId, userId, userProfile.displayName, JSON.stringify(cart), totals.subtotal, totals.totalDiscount, totals.tax, totals.grandTotal, 'รอชำระเงิน', paymentId ]);

  var totalAmount = totals.grandTotal;

  var isTrueMoneyConfigured = settings.qrWalletUrl && settings.trueMoneyNumber;

  if (isTrueMoneyConfigured) {
      var selectionFlex = generatePaymentSelectionFlex(totalAmount, paymentId);
      reply(replyToken, [selectionFlex], settings.payConnect);
      var tempPaymentData = { amount: totalAmount, paymentId: paymentId, type: 'shop' };
      cache.put('temp_payment_' + userId, JSON.stringify(tempPaymentData), 300);
  } else {
      var qrUrl = '';
      var promptPayId = settings.promptPayId;
      if (promptPayId && (promptPayId.length === 10 || promptPayId.length === 13)) {
        qrUrl = 'https://promptpay.io/' + promptPayId + '/' + totalAmount.toFixed(2);
      } else {
        var qrPayload = generatePromptPayPayload(promptPayId, totalAmount);
        qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrPayload) + "&size=500x500&margin=5";
      }

      logToSheet('Payments', [new Date(), userId, userProfile.displayName, totalAmount, 0, totalAmount, qrUrl, 'Generated', 'PromptPay', false, false, paymentId]);
      var paymentFlex = generatePaymentFlex(totalAmount, qrUrl, '#0c3b66', 'Shop Payment', true);
      reply(replyToken, [paymentFlex], settings.payConnect);
      var admins = getAdmins();
      if (admins.length > 0) {
        var adminFlex = generateAdminConfirmationFlex('PromptPay', totalAmount, userProfile.displayName, paymentId);
        admins.forEach(function(adminId) { pushMessage(adminId, [adminFlex]); });
      }
      clearAllCache(userId);
  }
}

function updateShopOrderOnPayment(paymentId, paymentType, isSuccess) {
    if (!paymentId.startsWith('SHOP')) {
        return;
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var orderSheet = ss.getSheetByName('Orders');
    var data = orderSheet.getRange(2, 1, orderSheet.getLastRow(), orderSheet.getLastColumn()).getValues();
    var orderRow = -1;
    var orderData = null;

    for (var i = data.length - 1; i >= 0; i--) {
        if (data[i][10] && data[i][10].toString().trim() === paymentId) {
            orderRow = i + 2;
            orderData = data[i];
            break;
        }
    }

    if (orderRow !== -1) {
        var newStatus = isSuccess ? 'ชำระเงินแล้ว' : 'ชำระเงินไม่สำเร็จ';
        orderSheet.getRange(orderRow, 10).setValue(newStatus);

        if (isSuccess) {
            var shopSheet = ss.getSheetByName('Shop');
            var lock = LockService.getScriptLock();
            lock.waitLock(30000);

            try {
                var itemsJson = orderData[4];
                var orderedItems = [];
                try {
                    orderedItems = JSON.parse(itemsJson);
                } catch(e) {
                    Logger.log("Could not parse itemsJson for order " + orderData[1] + ": " + itemsJson);
                }

                var shopData = shopSheet.getRange(2, 1, shopSheet.getLastRow() - 1, 8).getValues();

                orderedItems.forEach(function(item) {
                    for (var j = 0; j < shopData.length; j++) {
                        if (shopData[j][0] === item.id) {
                            var currentStock = parseInt(shopData[j][7], 10);
                            if (!isNaN(currentStock)) {
                                var newStock = currentStock - item.quantity;
                                shopSheet.getRange(j + 2, 8).setValue(newStock >= 0 ? newStock : 0);
                            }
                            break;
                        }
                    }
                });
            } catch (e) {
                Logger.log("Error during stock deduction for OrderID " + orderData[1] + ": " + e.stack);
            } finally {
                lock.releaseLock();
            }

            var receiptId = 'RCPT' + new Date().getTime();
            var itemsJsonForReceipt = orderData[4];
            var receiptData = {
                timestamp: new Date(),
                receiptId: receiptId,
                orderId: orderData[1],
                userId: orderData[2],
                displayName: orderData[3],
                items: [],
                total: orderData[8],
                paymentType: paymentType
            };
            try {
                receiptData.items = JSON.parse(itemsJsonForReceipt);
            } catch(e) {
                Logger.log("Could not parse itemsJsonForReceipt for order " + orderData[1] + ": " + itemsJsonForReceipt);
            }

            logToSheet('Receipts', [receiptData.timestamp, receiptId, receiptData.orderId, receiptData.userId, receiptData.displayName, itemsJsonForReceipt, receiptData.total, paymentType]);
        }
    }
}


function handleReceiptRequest(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  showLoadingAnimation(userId, 5);

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Receipts');
    if (!sheet || sheet.getLastRow() < 2) {
      reply(replyToken, [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณค่ะ' }], settings.payConnect);
      return;
    }
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var userReceipt = null;

    for (var i = data.length - 1; i >= 0; i--) {
      if (data[i][3] === userId) {
        var items = [];
        try {
            items = JSON.parse(data[i][5]);
        } catch(e) {
            Logger.log("Could not parse items for receipt: " + data[i][1]);
        }
        userReceipt = { timestamp: data[i][0], receiptId: data[i][1], orderId: data[i][2], userId: data[i][3], displayName: data[i][4], items: items, total: parseFloat(data[i][6]), paymentType: data[i][7] };
        break;
      }
    }

    if (userReceipt) {
      var receiptFlex = generateReceiptFlex(userReceipt);
      reply(replyToken, [receiptFlex], settings.payConnect);
    } else {
      reply(replyToken, [{ type: 'text', text: 'ไม่พบใบเสร็จของคุณ' }], settings.payConnect);
    }
  } catch(e) {
    Logger.log('Error in handleReceiptRequest: ' + e.stack);
    reply(replyToken, [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบเสร็จ' }], settings.payConnect);
  }
}

function handleMyOrdersRequest(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var settings = getSettings();
    if (!settings) return;
    showLoadingAnimation(userId, 5);
    var userProfile = getProfile(userId);

    try {
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
        if (!sheet || sheet.getLastRow() < 2) {
            reply(replyToken, [{ type: 'text', text: 'ไม่พบประวัติการสั่งซื้อของคุณค่ะ' }], settings.botConnect);
            return;
        }

        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        var userOrders = [];

        for (var i = 0; i < data.length; i++) {
            if (data[i][2] === userId) { // Column C is UserID
                userOrders.push({
                    date: new Date(data[i][0]),
                    orderId: data[i][1],
                    itemsJson: data[i][4],
                    total: parseFloat(data[i][8]),
                    status: data[i][9]
                });
            }
        }

        if (userOrders.length === 0) {
            reply(replyToken, [{ type: 'text', text: 'คุณยังไม่เคยทำการสั่งซื้อสินค้าค่ะ' }], settings.botConnect);
            return;
        }

        // Sort orders by date, newest first
        userOrders.sort(function(a, b) {
            return b.date - a.date;
        });

        var flexMessage = generateMyOrdersFlex(userOrders, userProfile.displayName);
        reply(replyToken, [flexMessage], settings.botConnect);

    } catch (e) {
        Logger.log('Error in handleMyOrdersRequest: ' + e.stack);
        reply(replyToken, [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการสั่งซื้อค่ะ' }], settings.botConnect);
    }
}

function findProductById(productId) {
    try {
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Shop');
        if (!sheet || sheet.getLastRow() < 2) return null;
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
        for (var i = 0; i < data.length; i++) {
            if (data[i][0] && data[i][0].toString().trim() === productId) {
                var imageUrl = data[i][6] && data[i][6].trim() !== '' ? data[i][6] : "https://via.placeholder.com/600x400.png?text=No+Image";
                var quantity = parseInt(data[i][7], 10);
                return {
                    id: data[i][0],
                    name: data[i][1],
                    price: parseFloat(data[i][2]),
                    discount: parseFloat(data[i][3] || 0),
                    taxable: data[i][4],
                    downloadUrl: data[i][5],
                    imageUrl: imageUrl,
                    quantity: isNaN(quantity) ? 0 : quantity
                };
            }
        }
        return null;
    } catch (e) {
        Logger.log('Error in findProductById: ' + e.stack);
        return null;
    }
}


function calculateCartTotals(cart) {
  var subtotal = 0; var totalDiscount = 0; var tax = 0; var taxRate = 0.07;
  cart.forEach(function(item) {
    var itemSubtotal = item.price * item.quantity;
    var itemDiscount = item.discount * item.quantity;
    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;
    if (item.taxable === true) {
      tax += (item.price - item.discount) * item.quantity * taxRate;
    }
  });
  var grandTotal = subtotal - totalDiscount + tax;
  return { subtotal: subtotal, totalDiscount: totalDiscount, tax: tax, grandTotal: grandTotal };
}

/********************************************************************************
* ฟังก์ชันจัดการคำร้องขอเชื่อมต่อ (Existing Function)
********************************************************************************/
function handleConnectRequest(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;

  var userRecord = findUserInDataSheet(userId);

  if (userRecord && userRecord.status === 'Connect Pay') {
    var alreadyConnectedFlex = { type: 'flex', altText: 'คุณเป็นสมาชิกอยู่แล้ว', contents: {"type": "bubble", "size": "mega", "header": {"type": "box", "layout": "vertical", "contents": [{"type": "box", "layout": "baseline", "contents": [{"type": "icon", "url": "https://api.iconify.design/material-symbols/info-outline.svg?color=%23ffffff", "size": "xl"}, {"type": "text", "text": "เชื่อมต่ออยู่แล้ว", "weight": "bold", "color": "#FFFFFF", "size": "lg", "margin": "md"}]}], "backgroundColor": "#1976D2", "paddingAll": "20px"}, "body": {"type": "box", "layout": "vertical", "contents": [{"type": "text", "text": "คุณได้เชื่อมต่อบริการแจ้งเตือนอัตโนมัติเรียบร้อยแล้ว", "wrap": true, "align": "center", "size": "md", "weight": "bold", "color": "#333333"}, {"type": "text", "text": "ไม่จำเป็นต้องทำการสมัครซ้ำค่ะ", "wrap": true, "align": "center", "size": "sm", "color": "#666666", "margin": "md"}], "paddingAll": "24px"}} };
    reply(replyToken, [alreadyConnectedFlex], settings.payConnect);
    return;
  }
  var dataSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data');
  if (userRecord) {
    dataSheet.getRange(userRecord.row, 4).setValue('Connect Pay');
  } else {
    var userProfile = getProfile(userId);
    logToSheet('Data', [new Date(), userId, userProfile.displayName, 'Connect Pay']);
  }
  var connectSuccessFlex = { "type": "bubble", "size": "mega", "header": {"type": "box", "layout": "vertical", "contents": [{"type": "box", "layout": "baseline", "contents": [{"type": "icon", "url": "https://api.iconify.design/material-symbols/check-circle-outline-rounded.svg?color=%23ffffff", "size": "xl"}, {"type": "text", "text": "Connect Success", "weight": "bold", "color": "#FFFFFF", "size": "lg", "margin": "md"}]}], "backgroundColor": "#388E3C", "paddingAll": "20px"}, "body": {"type": "box", "layout": "vertical", "contents": [{"type": "text", "text": "เชื่อมต่อบริการสำเร็จค่ะ", "wrap": true, "align": "center", "size": "md", "weight": "bold", "color": "#333333"}, {"type": "text", "text": "คุณจะได้รับการแจ้งเตือนผลการชำระเงินโดยอัตโนมัติ", "wrap": true, "align": "center", "size": "sm", "color": "#666666", "margin": "md"}], "paddingAll": "24px"} };
  reply(replyToken, [{ type: 'flex', altText: 'เชื่อมต่อบริการสำเร็จ', contents: connectSuccessFlex }], settings.payConnect);
}

/********************************************************************************
* ฟังก์ชันสร้างข้อความตอบกลับ (buildReplyMessages)
********************************************************************************/
function buildReplyMessages(rowData) {
  var messageType = rowData[1].toString().trim().toLowerCase();
  var content = rowData[2];
  var messages = [];

  try {
    var mainMessage;
    switch (messageType) {
      case 'text': mainMessage = { type: 'text', text: content }; break;
      case 'image': mainMessage = { type: 'image', originalContentUrl: content, previewImageUrl: content }; break;
      case 'flex': mainMessage = { type: 'flex', altText: rowData[0], contents: JSON.parse(content) }; break;
      case 'imagemap':
        var imagemapContent = JSON.parse(content);
        mainMessage = { type: 'imagemap', baseUrl: imagemapContent.baseUrl, altText: rowData[0], baseSize: imagemapContent.baseSize || { width: 1040, height: 1040 }, actions: imagemapContent.actions };
        break;
      default: mainMessage = { type: 'text', text: 'ไม่รู้จักประเภทของข้อความตอบกลับ: ' + messageType };
    }

    var quickReplyItems = [];
    for (var i = 3; i < rowData.length; i++) {
      if (rowData[i] && rowData[i].toString().trim() !== '') {
        var label = rowData[i].toString();
        quickReplyItems.push({ type: 'action', action: { type: 'message', label: label, text: label } });
      }
    }
    if (quickReplyItems.length > 0) { mainMessage.quickReply = { items: quickReplyItems }; }
    messages.push(mainMessage);
  } catch (e) {
    Logger.log("Message Building Error: " + e.toString() + " | Content: " + content);
    messages.push({ type: 'text', text: 'เกิดข้อผิดพลาดในการสร้างข้อความ: ' + e.message });
  }
  return messages;
}


function handleCancellation(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;

  clearAllCache(userId);
  reply(replyToken, [{ type: 'text', text: 'ยกเลิกรายการเรียบร้อยค่ะ' }], settings.botConnect);
}

/********************************************************************************
* ฟังก์ชันสำหรับ Admin Dashboard
********************************************************************************/
function handleAdminDashboardRequest(event) {
  try {
    var summary = getDashboardSummary();
    var flexMessage = generateAdminDashboardFlex(summary);
    reply(event.replyToken, [flexMessage], getSettings().botConnect);
  } catch(e) {
    Logger.log("Error in handleAdminDashboardRequest: " + e.stack);
    reply(event.replyToken, [{type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard ค่ะ'}], getSettings().botConnect);
  }
}

function handleAdminPendingClick(event) {
  var replyToken = event.replyToken;
  var paymentId = event.message.text.substring('ADMIN_CHECK_PAYMENTID_'.length);
  var payment = findPaymentById(paymentId);
  if (payment) {
    var adminFlex = generateAdminConfirmationFlex(payment.paymentType, payment.amount, payment.displayName, paymentId);
    reply(replyToken, [adminFlex], getSettings().payConnect);
  } else {
    reply(replyToken, [{ type: 'text', text: 'ไม่พบรายการชำระเงิน ID: ' + paymentId }], getSettings().payConnect);
  }
}

function handleAdminCallQueue(event) {
  var replyToken = event.replyToken;
  var queueNumber = event.message.text.substring('ADMIN_CALL_QUEUE_'.length);
  var bookingSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Booking');
  if (bookingSheet.getLastRow() < 2) return;

  var data = bookingSheet.getRange(2, 1, bookingSheet.getLastRow() - 1, bookingSheet.getLastColumn()).getValues();
  var bookingRow = -1;
  var bookingData = null;

  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][7] === queueNumber && data[i][6] === 'Confirmed') {
      bookingRow = i + 2;
      bookingData = data[i];
      break;
    }
  }

  if (bookingData) {
    var userId = bookingData[1];
    var displayName = bookingData[2];
    bookingSheet.getRange(bookingRow, 7).setValue('เข้ารับบริการแล้ว');
    var userMessage = {
      type: 'text',
      text: 'ถึงคิวของคุณแล้วค่ะ (คิว ' + queueNumber + ')\nกรุณาติดต่อที่เคาน์เตอร์บริการค่ะ'
    };
    pushMessage(userId, [userMessage], getSettings().botConnect);
    reply(replyToken, [{ type: 'text', text: '✅ แจ้งเตือนคุณ ' + displayName + ' (คิว ' + queueNumber + ') เรียบร้อยแล้ว' }], getSettings().botConnect);
  } else {
    reply(replyToken, [{ type: 'text', text: 'ไม่พบคิว ' + queueNumber + ' หรือคิวถูกเรียกไปแล้ว' }], getSettings().botConnect);
  }
}

function getDashboardSummary() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var paymentsSheet = ss.getSheetByName('Payments');
  var bookingSheet = ss.getSheetByName('Booking');

  var summary = {
    successCount: 0,
    pendingCount: 0,
    canceledCount: 0,
    successPayments: [],
    successBookings: [],
    pendingPayments: [],
    pendingBookings: [],
    failedPayments: []
  };

  // Process Payments
  if (paymentsSheet.getLastRow() > 1) {
    var paymentsData = paymentsSheet.getRange(2, 1, paymentsSheet.getLastRow() - 1, paymentsSheet.getLastColumn()).getValues();
    paymentsData.reverse().forEach(function(row) {
      var paymentId = row[11];
      var status = row[7];
      var itemName = paymentId.startsWith('SHOP') ? 'สั่งซื้อสินค้า' : 'ชำระเงินออนไลน์';

      if (status === 'Confirmed') {
        summary.successCount++;
        if (summary.successPayments.length < 5) summary.successPayments.push({ id: paymentId, name: itemName, amount: row[5] });
      } else if (status === 'Generated') {
        summary.pendingCount++;
        if (summary.pendingPayments.length < 5) summary.pendingPayments.push({ id: paymentId, name: itemName, amount: row[5] });
      } else if (status === 'Failed') {
        summary.canceledCount++;
        if (summary.failedPayments.length < 5) summary.failedPayments.push({ id: paymentId, name: itemName, amount: row[5] });
      }
    });
  }

  // Process Bookings
  if (bookingSheet.getLastRow() > 1) {
    var bookingsData = bookingSheet.getRange(2, 1, bookingSheet.getLastRow() - 1, bookingSheet.getLastColumn()).getValues();
    bookingsData.reverse().forEach(function(row) {
      var status = row[6];
      if (status === 'เข้ารับบริการแล้ว') {
        summary.successCount++;
        if (summary.successBookings.length < 5) summary.successBookings.push({ id: row[7], name: row[4], queue: row[7] });
      } else if (status === 'Confirmed') {
        summary.pendingCount++;
        if (summary.pendingBookings.length < 5) summary.pendingBookings.push({ id: row[7], name: row[4], queue: row[7] });
      } else if (status === 'Canceled') { // Assuming you might add a 'Canceled' status
        summary.canceledCount++;
      }
    });
  }
  return summary;
}


/********************************************************************************
* ฟังก์ชันระบบชำระเงิน (Payment Functions)
********************************************************************************/
function startPaymentFlow(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  var userProfile = getProfile(userId);
  var cache = CacheService.getScriptCache();

  cache.put('payment_state_' + userId, 'awaiting_amount', 300);
  cache.put('user_flow_' + userId, 'payment', 300);

  var messageText = 'สวัสดีครับคุณ ' + userProfile.displayName + '\nกรุณาแจ้งยอดเงินที่ต้องการชำระครับ';
  reply(replyToken, [{ type: 'text', text: messageText }], settings.payConnect);
}

function handlePaymentState(event, state) {
  var replyToken = event.replyToken;
  var userMessage = event.message.text.trim();
  var settings = getSettings();
  if (!settings) return;

  if (state === 'awaiting_amount') {
    var numericMessage = userMessage.replace(/,/g, '');
    var amount = parseFloat(numericMessage);

    if (isNaN(amount) || amount < 1 || amount > 50000) {
      var warningText = 'ขออภัยค่ะ ยอดชำระต้องอยู่ระหว่าง 1 - 50,000 บาท\nกรุณาระบุยอดเงินที่ต้องการชำระอีกครั้งค่ะ';
      reply(replyToken, [{ type: 'text', text: warningText }], settings.payConnect);
      return;
    }
    routePaymentFlow(event, amount);
  }
}

function routePaymentFlow(event, amount) {
  var settings = getSettings();
  var isTrueMoneyConfigured = settings.qrWalletUrl && settings.trueMoneyNumber;

  if (isTrueMoneyConfigured) {
    sendPaymentMethodSelection(event, amount);
  } else {
    generateDirectPromptPay(event, amount);
  }
}

function sendPaymentMethodSelection(event, amount) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  var cache = CacheService.getScriptCache();

  var paymentId = 'PAY' + Math.floor(1000000 + Math.random() * 9000000);

  var tempPaymentData = { amount: amount, paymentId: paymentId, type: 'general' };
  cache.put('temp_payment_' + userId, JSON.stringify(tempPaymentData), 300);

  var flexMessage = generatePaymentSelectionFlex(amount, paymentId);
  reply(replyToken, [flexMessage], settings.payConnect);

  cache.remove('payment_state_' + userId);
  cache.remove('user_flow_' + userId);
}

function processPaymentSelection(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var userMessage = event.message.text.trim();
    var settings = getSettings();
    if (!settings) return;
    showLoadingAnimation(userId, 5);
    var cache = CacheService.getScriptCache();
    var userProfile = getProfile(userId);

    var tempPaymentDataJson = cache.get('temp_payment_' + userId);
    if (!tempPaymentDataJson) {
        reply(replyToken, [{ type: 'text', text: 'รายการชำระเงินหมดอายุ กรุณาทำรายการใหม่อีกครั้งค่ะ' }], settings.payConnect);
        return;
    }
    var tempPaymentData = JSON.parse(tempPaymentDataJson);
    var amount = tempPaymentData.amount;
    var paymentId = tempPaymentData.paymentId;
    var paymentType = '';
    var qrUrl = '', headerColor = '', paymentTitle = '';

    var messageAction = userMessage.replace(paymentId, '');

    if (messageAction === 'PromptPay') {
        paymentType = 'PromptPay';
        var promptPayId = settings.promptPayId;
        if (promptPayId && (promptPayId.length === 10 || promptPayId.length === 13)) {
            qrUrl = 'https://promptpay.io/' + promptPayId + '/' + amount.toFixed(2);
        } else {
            var qrPayload = generatePromptPayPayload(promptPayId, amount);
            qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrPayload) + "&size=500x500&margin=5";
        }
        headerColor = '#0c3b66';
        paymentTitle = 'Thai QR Payment';
    } else if (messageAction === 'TrueMoney') {
        paymentType = 'Truemoney Wallet';
        qrUrl = settings.qrWalletUrl;
        headerColor = '#FF6600';
        paymentTitle = 'TrueMoney Wallet Payment';
    } else {
        return;
    }

    if (tempPaymentData.type === 'shop') {
        paymentTitle = 'Shop Payment';
    }

    logToSheet('Payments', [new Date(), userId, userProfile.displayName, amount, 0, amount, qrUrl, 'Generated', paymentType, false, false, paymentId]);

    var flexMessage = generatePaymentFlex(amount, qrUrl, headerColor, paymentTitle, true);
    reply(replyToken, [flexMessage], settings.payConnect);

    var admins = getAdmins();
    if (admins.length > 0) {
        var adminFlex = generateAdminConfirmationFlex(paymentType, amount, userProfile.displayName, paymentId);
        admins.forEach(function(adminId) { pushMessage(adminId, [adminFlex]); });
    }

    clearAllCache(userId);
}


function generateDirectPromptPay(event, amount) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var settings = getSettings();
    if (!settings) return;
    showLoadingAnimation(userId, 5);
    var userProfile = getProfile(userId);

    var paymentId = 'CC' + Math.floor(1000000 + Math.random() * 9000000);
    var paymentType = 'PromptPay';
    var qrUrl = '';
    var promptPayId = settings.promptPayId;

    if (promptPayId && (promptPayId.length === 10 || promptPayId.length === 13)) {
        qrUrl = 'https://promptpay.io/' + promptPayId + '/' + amount.toFixed(2);
    } else {
        var qrPayload = generatePromptPayPayload(promptPayId, amount);
        qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrPayload) + "&size=500x500&margin=5";
    }

    var headerColor = '#0c3b66';
    var paymentTitle = 'Thai QR Payment';

    logToSheet('Payments', [new Date(), userId, userProfile.displayName, amount, 0, amount, qrUrl, 'Generated', paymentType, false, false, paymentId]);
    var flexMessage = generatePaymentFlex(amount, qrUrl, headerColor, paymentTitle, true);
    reply(replyToken, [flexMessage], settings.payConnect);

    var admins = getAdmins();
    if (admins.length > 0) {
        var adminFlex = generateAdminConfirmationFlex(paymentType, amount, userProfile.displayName, paymentId);
        admins.forEach(function(adminId) { pushMessage(adminId, [adminFlex]); });
    }

    clearAllCache(userId);
}


function handleAdminConfirmation(event) {
  var replyToken = event.replyToken;
  var messageText = event.message.text.trim();
  var action = ''; var paymentId = '';

  if (messageText.startsWith('CONFIRM ')) {
    action = 'CONFIRM';
    paymentId = messageText.substring('CONFIRM '.length);
  } else if (messageText.startsWith('CANCEL PAY ')) {
    action = 'CANCEL PAY';
    paymentId = messageText.substring('CANCEL PAY '.length);
  }
  if (!action || !paymentId) { return; }

  var paymentSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Payments');
  var data = paymentSheet.getRange(2, 1, paymentSheet.getLastRow(), paymentSheet.getLastColumn()).getValues();
  var paymentRow = -1; var rowData;

  for (var i = 0; i < data.length; i++) {
    if (data[i][11] && data[i][11].toString().trim() == paymentId) {
      paymentRow = i + 2;
      rowData = data[i];
      break;
    }
  }

  if (paymentRow !== -1) {
    if (rowData[7] !== 'Generated') {
      reply(replyToken, [{ type: 'text', text: 'รายการนี้ได้รับการยืนยันไปแล้ว' }], getSettings().payConnect);
      return;
    }

    var userId = rowData[1];
    var displayName = rowData[2];
    var amount = parseFloat(rowData[3]);
    var totalAmount = parseFloat(rowData[5]);
    var paymentType = rowData[8];

    var isSuccess = (action === 'CONFIRM');
    if (isSuccess) {
      paymentSheet.getRange(paymentRow, 8).setValue('Confirmed');
      paymentSheet.getRange(paymentRow, 10).check();
      paymentSheet.getRange(paymentRow, 11).uncheck();
    } else {
      paymentSheet.getRange(paymentRow, 8).setValue('Failed');
      paymentSheet.getRange(paymentRow, 11).check();
      paymentSheet.getRange(paymentRow, 10).uncheck();
    }
    processSuccessfulPayment(paymentId, paymentType, userId, displayName, amount, totalAmount, isSuccess);
    var adminReplyFlex = generateAdminReplyFlex(isSuccess, amount, displayName);
    reply(replyToken, [adminReplyFlex], getSettings().payConnect);
  } else {
    reply(replyToken, [{ type: 'text', text: 'ไม่พบรายการชำระเงินสำหรับ ID: ' + paymentId }], getSettings().payConnect);
  }
}

function processSuccessfulPayment(paymentId, paymentType, userId, displayName, amount, totalAmount, isSuccess) {
  var settings = getSettings();
  if (!settings) return;

  var isShopPayment = paymentId.startsWith('SHOP');
  var quickReply = null;

  if (isSuccess && isShopPayment) {
    var quickReplyItems = [];
    quickReplyItems.push({
      type: 'action',
      imageUrl: 'https://cdn-icons-gif.flaticon.com/11188/11188760.gif',
      action: { type: 'message', label: 'Shop :Receipt', text: 'ใบเสร็จ' }
    });
    if (settings.urlAddress) {
      quickReplyItems.push({
        type: 'action',
        imageUrl: 'https://cliply.co/wp-content/uploads/2019/03/371903340_LOCATION_MARKER_400.gif',
        action: { type: 'uri', label: 'Form : Address', uri: settings.urlAddress }
      });
    }
    quickReply = { items: quickReplyItems };
  }

  var paymentStatusData = {
    paymentType: paymentType,
    amount: amount,
    isSuccess: isSuccess,
    isUnsuccess: !isSuccess
  };
  var userFlexMessage = generatePaymentStatusFlex(paymentStatusData);
  if (quickReply) {
    userFlexMessage.quickReply = quickReply;
  }

  if (userFlexMessage && userId) {
    var userRecord = findUserInDataSheet(userId);
    if (userRecord && userRecord.status === 'Connect Pay') {
        pushMessage(userId, [userFlexMessage]);
    }
  }

  if (isSuccess) {
    var statementItemName = isShopPayment ? 'QR Payment' : (paymentType === 'PromptPay' ? 'QR Payment' : 'TMN Payment');
    var statementItemDesc = isShopPayment ? 'ชำระสินค้าระบบ Shop' : (paymentType === 'PromptPay' ? 'ชำระเงินผ่าน PromptPay' : 'ชำระผ่าน TrueMoney');
    var now = new Date();
    var timeString = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var pointsEarned = totalAmount * 0.05;
    var statementData = [ now, timeString, userId, displayName, paymentType, statementItemName, statementItemDesc, amount, pointsEarned.toFixed(2), totalAmount ];
    logToSheet('Statement', statementData);
  }
  updateShopOrderOnPayment(paymentId, paymentType, isSuccess);
}

/********************************************************************************
* ฟังก์ชันระบบ Statement และ ตรวจสอบสถานะ
********************************************************************************/
function handleStatementRequest(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  showLoadingAnimation(userId, 5);
  var userProfile = getProfile(userId);
  var displayName = userProfile.displayName;

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Statement');
  if (!sheet || sheet.getLastRow() < 2) {
    reply(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูล Statement ของคุณค่ะ' }], settings.payConnect);
    return;
  }
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var userTransactions = [];
  var totalAmount = 0;

  for (var i = 0; i < data.length; i++) {
    if (data[i][2] === userId) {
      var amountValue = parseFloat(data[i][7]);
      if (!isNaN(amountValue)) {
        totalAmount += amountValue;
        userTransactions.push({ bank: data[i][4], itemName: data[i][5], item: data[i][6], amount: amountValue, date: data[i][0] });
      }
    }
  }
  var pointTotal = totalAmount * 0.05;
  var creditTotal = pointTotal * 0.025;
  userTransactions.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
  var flexMessage = generateStatementFlex(displayName, totalAmount, pointTotal, creditTotal, userTransactions);
  reply(replyToken, [flexMessage], settings.payConnect);
}

function handlePaymentStatusRequest(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var settings = getSettings();
    if (!settings) return;
    showLoadingAnimation(userId, 5);

    try {
        var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Payments');
        if (!sheet || sheet.getLastRow() < 2) {
            reply(replyToken, [{ type: 'text', text: 'ไม่พบประวัติการชำระเงินของคุณค่ะ' }], settings.payConnect);
            return;
        }
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        var lastUserPayment = null;

        for (var i = data.length - 1; i >= 0; i--) {
            if (data[i][1] === userId) {
                lastUserPayment = {
                    paymentType: data[i][8],
                    amount: parseFloat(data[i][3]),
                    isSuccess: data[i][9] === true,
                    isUnsuccess: data[i][10] === true
                };
                break;
            }
        }

        if (lastUserPayment) {
            var statusFlex = generatePaymentStatusFlex(lastUserPayment);
            reply(replyToken, [statusFlex], settings.payConnect);
        } else {
            reply(replyToken, [{ type: 'text', text: 'ไม่พบประวัติการชำระเงินของคุณค่ะ' }], settings.payConnect);
        }
    } catch (e) {
        Logger.log('Error in handlePaymentStatusRequest: ' + e.stack);
        reply(replyToken, [{ type: 'text', text: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }], settings.payConnect);
    }
}


/********************************************************************************
* FLEX MESSAGE GENERATORS
********************************************************************************/

function generateAdminDashboardFlex(summary) {
  var flex = { "type": "bubble", "size": "giga", "body": { "type": "box", "layout": "vertical", "backgroundColor": "#F5F7FB", "contents": [ { "type": "text", "text": "Admin Information User", "weight": "bold", "size": "lg", "color": "#4B4B4B", "margin": "md" }, { "type": "box", "layout": "horizontal", "spacing": "sm", "margin": "lg", "contents": [ { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "8px", "alignItems": "center", "justifyContent": "center", "paddingAll": "12px", "flex": 1, "contents": [ { "type": "text", "text": summary.successCount.toLocaleString('th-TH'), "weight": "bold", "size": "lg", "color": "#00FF00" }, { "type": "text", "text": "ทำรายการสำเร็จ", "size": "xxs", "color": "#888888" } ] }, { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "8px", "alignItems": "center", "justifyContent": "center", "paddingAll": "12px", "flex": 1, "contents": [ { "type": "text", "text": summary.pendingCount.toLocaleString('th-TH'), "weight": "bold", "size": "lg", "color": "#FFCC00" }, { "type": "text", "text": "รอดำเนินการ", "size": "xxs", "color": "#888888" } ] }, { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "8px", "alignItems": "center", "justifyContent": "center", "paddingAll": "12px", "flex": 1, "contents": [ { "type": "text", "text": summary.canceledCount.toLocaleString('th-TH'), "weight": "bold", "size": "lg", "color": "#FF0000" }, { "type": "text", "text": "ยกเลิกรายการแล้ว", "size": "xxs", "color": "#888888" } ] } ] } ] } };

  // --- Success Information ---
  var successPaymentsContents = summary.successPayments.map(function(item) {
    return { "type": "box", "layout": "horizontal", "spacing": "sm", "contents": [ { "type": "text", "text": item.id.slice(-6), "size": "xxs", "color": "#666666", "flex": 2, "align": "center" }, { "type": "text", "text": item.name, "size": "xxs", "color": "#111111", "flex": 5, "align": "center", "wrap": true }, { "type": "text", "text": item.amount.toLocaleString('th-TH', {minimumFractionDigits: 2}), "size": "xxs", "flex": 4, "align": "start" }, { "type": "text", "text": "รายการสำเร็จ", "size": "xxs", "align": "center", "color": "#00B140", "flex": 3 } ] };
  });
  if (successPaymentsContents.length === 0) successPaymentsContents.push({"type": "text", "text": "ไม่มีรายการ", "size": "sm", "align": "center", "color": "#AAAAAA"});

  var successBookingsContents = summary.successBookings.map(function(item) {
    return { "type": "box", "layout": "horizontal", "spacing": "sm", "contents": [ { "type": "text", "text": item.id.slice(-6), "size": "xxs", "color": "#666666", "flex": 2, "align": "center" }, { "type": "text", "text": item.name, "size": "xxs", "color": "#111111", "flex": 5, "align": "center", "wrap": true }, { "type": "text", "text": item.queue, "size": "xxs", "flex": 4, "align": "start" }, { "type": "text", "text": "บริการแล้ว", "size": "xxs", "align": "center", "color": "#00B140", "flex": 3 } ] };
  });
  if (successBookingsContents.length === 0) successBookingsContents.push({"type": "text", "text": "ไม่มีรายการ", "size": "sm", "align": "center", "color": "#AAAAAA"});

  flex.body.contents.push({ "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "margin": "md", "paddingAll": "12px", "contents": [ { "type": "text", "text": "Success Information", "weight": "bold", "size": "md", "color": "#333333" }, { "type": "separator", "margin": "md" }, { "type": "box", "layout": "vertical", "spacing": "md", "margin": "md", "contents": successPaymentsContents }, { "type": "text", "text": "Success Queue", "weight": "bold", "size": "md", "color": "#333333", "margin": "xxl" }, { "type": "separator", "margin": "md" }, { "type": "box", "layout": "vertical", "spacing": "md", "margin": "md", "contents": successBookingsContents }]});

  // --- Waiting For Inspection ---
  var pendingPaymentsContents = summary.pendingPayments.map(function(item) {
    return { "type": "box", "layout": "horizontal", "spacing": "sm", "action": {"type": "message", "label": "ตรวจสอบ", "text": "ADMIN_CHECK_PAYMENTID_" + item.id}, "contents": [ { "type": "text", "text": item.id.slice(-6), "size": "xxs", "color": "#666666", "flex": 2, "align": "center" }, { "type": "text", "text": item.name, "size": "xxs", "color": "#111111", "flex": 5, "align": "center", "wrap": true }, { "type": "text", "text": item.amount.toLocaleString('th-TH', {minimumFractionDigits: 2}), "size": "xxs", "flex": 4, "align": "start" }, { "type": "text", "text": "รอตรวจสอบ", "size": "xxs", "align": "center", "color": "#FFCC00", "flex": 3, "weight":"bold" } ] };
  });
  if (pendingPaymentsContents.length === 0) pendingPaymentsContents.push({"type": "text", "text": "ไม่มีรายการ", "size": "sm", "align": "center", "color": "#AAAAAA"});

  var pendingBookingsContents = summary.pendingBookings.map(function(item) {
    return { "type": "box", "layout": "horizontal", "spacing": "sm", "action": {"type": "message", "label": "เรียกคิว", "text": "ADMIN_CALL_QUEUE_" + item.id}, "contents": [ { "type": "text", "text": item.id.slice(-6), "size": "xxs", "color": "#666666", "flex": 2, "align": "center" }, { "type": "text", "text": item.name, "size": "xxs", "color": "#111111", "flex": 5, "align": "center", "wrap": true }, { "type": "text", "text": item.queue, "size": "xxs", "flex": 4, "align": "start" }, { "type": "text", "text": "รอเรียกคิว", "size": "xxs", "align": "center", "color": "#FFCC00", "flex": 3, "weight":"bold" } ] };
  });
 if (pendingBookingsContents.length === 0) pendingBookingsContents.push({"type": "text", "text": "ไม่มีรายการ", "size": "sm", "align": "center", "color": "#AAAAAA"});

  flex.body.contents.push({ "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "margin": "md", "paddingAll": "12px", "contents": [ { "type": "text", "text": "Waiting For Inspection", "weight": "bold", "size": "md", "color": "#333333" }, { "type": "separator", "margin": "md" }, { "type": "box", "layout": "vertical", "spacing": "md", "margin": "md", "contents": pendingPaymentsContents }, { "type": "text", "text": "Waiting For Service", "weight": "bold", "size": "md", "color": "#333333", "margin": "xxl" }, { "type": "separator", "margin": "md" }, { "type": "box", "layout": "vertical", "spacing": "md", "margin": "md", "contents": pendingBookingsContents } ] });

  // --- Unsuccess List ---
  var failedPaymentsContents = summary.failedPayments.map(function(item) {
    return { "type": "box", "layout": "horizontal", "spacing": "sm", "contents": [ { "type": "text", "text": item.id.slice(-6), "size": "xxs", "color": "#666666", "flex": 2, "align": "center" }, { "type": "text", "text": item.name, "size": "xxs", "color": "#111111", "flex": 5, "align": "center", "wrap": true }, { "type": "text", "text": item.amount.toLocaleString('th-TH', {minimumFractionDigits: 2}), "size": "xxs", "flex": 4, "align": "start" }, { "type": "text", "text": "ยกเลิกแล้ว", "size": "xxs", "align": "center", "color": "#FF0000", "flex": 3 } ] };
  });
  if (failedPaymentsContents.length === 0) failedPaymentsContents.push({"type": "text", "text": "ไม่มีรายการ", "size": "sm", "align": "center", "color": "#AAAAAA"});

  flex.body.contents.push({ "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "margin": "md", "paddingAll": "12px", "contents": [ { "type": "text", "text": "Unsuccess List Verification", "weight": "bold", "size": "md", "color": "#333333" }, { "type": "separator", "margin": "md" }, { "type": "box", "layout": "vertical", "spacing": "md", "margin": "md", "contents": failedPaymentsContents } ] });


  return { type: 'flex', altText: 'Admin Dashboard', contents: flex };
}

function generateShopListFlex(products) {
    function createProductBox(p) {
        if (!p) return { "type": "box", "layout": "vertical", "flex": 1, "contents": [] };

        var discountedPrice = p.price - p.discount;
        var originalPriceComponent = { type: "filler" };
        if (p.discount && p.discount > 0) {
            originalPriceComponent = {
                "type": "text", "text": "฿" + p.price.toLocaleString('th-TH'),
                "size": "xs", "color": "#888888", "decoration": "line-through"
            };
        }

        return {
            "type": "box", "layout": "vertical", "borderColor": "#E0E0E0", "borderWidth": "1px",
            "cornerRadius": "16px", "paddingAll": "12px", "flex": 1,
            "contents": [
                { "type": "image", "url": p.imageUrl, "size": "full", "aspectRatio": "1:1", "aspectMode": "cover" },
                { "type": "text", "text": p.name, "weight": "bold", "size": "sm", "margin": "md", "wrap": true },
                originalPriceComponent,
                { "type": "box", "layout": "horizontal", "margin": "md",
                    "contents": [
                        { "type": "text", "text": "฿" + discountedPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 }), "weight": "bold", "size": "sm", "flex": 1, "gravity": "center" },
                        { "type": "box", "layout": "vertical", "width": "28px", "height": "28px", "cornerRadius": "100px", "backgroundColor": "#FFB800", "alignItems": "center", "justifyContent": "center",
                            "action": { "type": "message", "label": "add", "text": "ADD_TO_CART_" + p.id },
                            "contents": [ { "type": "text", "text": "+", "align": "center", "color": "#FFFFFF", "weight": "bold" } ]
                        }
                    ]
                }
            ]
        };
    }

    var productRows = [];
    for (var i = 0; i < products.length; i += 2) {
        var p1 = products[i];
        var p2 = products[i + 1];
        var row = {
            "type": "box", "layout": "horizontal", "spacing": "md",
            "contents": [ createProductBox(p1), createProductBox(p2) ]
        };
        productRows.push(row);
    }

    var bubble = {
        "type": "bubble", "size": "giga",
        "body": { "type": "box", "layout": "vertical",
            "contents": [
                { "type": "text", "text": "Products", "weight": "bold", "size": "xl", "margin": "md", "align": "start", "gravity": "center" },
                { "type": "box", "layout": "vertical", "spacing": "md", "margin": "lg", "contents": productRows }
            ]
        }
    };

    return { type: "flex", altText: "รายการสินค้าในร้าน", contents: bubble };
}


function generateCartFlex(cart, orderId) {
    var itemContents = [];
    if (cart.length > 0) {
        cart.forEach(function(item) {
            var itemPrice = (item.price - item.discount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
            itemContents.push({
                "type": "box", "layout": "horizontal", "backgroundColor": "#F8F8FF", "cornerRadius": "12px", "paddingAll": "12px",
                "contents": [
                    { "type": "image", "url": item.imageUrl, "size": "xs" },
                    { "type": "box", "layout": "vertical", "flex": 5, "margin": "sm",
                        "contents": [
                            { "type": "text", "text": item.name, "weight": "bold", "size": "sm" },
                            { "type": "box", "layout": "baseline", "spacing": "sm",
                                "contents": [ { "type": "text", "text": "฿ " + itemPrice, "size": "sm", "color": "#D32F2F", "align": "start" } ]
                            }
                        ]
                    },
                    { "type": "box", "layout": "horizontal", "spacing": "sm", "contents": [ { "type": "text", "text": item.quantity.toString(), "align": "center" } ] }
                ]
            });
        });
    }

    var totals = calculateCartTotals(cart);

    var bubble = {
        "type": "bubble", "size": "mega",
        "header": { "type": "box", "layout": "baseline", "backgroundColor": "#FFFAFA", "paddingAll": "12px", "contents": [ { "type": "text", "text": "Product In The Cart", "weight": "bold", "size": "lg", "margin": "md", "align": "center" } ] },
        "body": { "type": "box", "layout": "vertical", "spacing": "md",
            "contents": [].concat(itemContents).concat([
                { "type": "box", "layout": "vertical", "spacing": "xs", "margin": "xxl",
                    "contents": [
                        { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": "Sub Total", "size": "sm", "color": "#666666" }, { "type": "text", "text": totals.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " .-", "size": "sm", "align": "end" } ] },
                        { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": "Discount Total", "size": "sm", "color": "#666666" }, { "type": "text", "text": totals.totalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " .-", "size": "sm", "align": "end" } ] },
                        { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": "Total Tax 7%", "size": "sm", "color": "#666666" }, { "type": "text", "text": totals.tax.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " .-", "size": "sm", "align": "end" } ] },
                        { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": "Total Payment", "weight": "bold", "size": "md" }, { "type": "text", "text": totals.grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " .-", "weight": "bold", "size": "md", "align": "end", "color": "#D32F2F" } ] }
                    ]
                },
                { "type": "button", "height": "sm", "gravity": "top", "style": "primary", "action": { "type": "message", "label": "Payment Click", "text": "Payment : Shop_" + orderId } }
            ])
        }
    };
    return { type: 'flex', altText: 'ตะกร้าสินค้าของคุณ', contents: bubble };
}

function generateReceiptFlex(receiptData) {
  var itemContents = [];
  var totals = calculateCartTotals(receiptData.items || []);
  (receiptData.items || []).forEach(function(item) {
    var itemSubtotal = (item.price || 0) * (item.quantity || 1);
    itemContents.push({ "type": "box", "layout": "horizontal", "margin": "sm", "contents": [ { "type": "text", "text": item.name, "size": "sm", "color": "#222222", "flex": 3, "wrap": true }, { "type": "text", "text": itemSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " THB", "size": "sm", "color": "#222222", "align": "end", "flex": 2 } ] });
  });

  var receiptBubble = { "type": "bubble", "size": "mega", "body": { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "16px", "paddingAll": "20px", "contents": [ { "type": "text", "text": "Receipt Shop", "size": "xs", "color": "#888888", "align": "center" }, { "type": "text", "text": receiptData.displayName, "size": "lg", "weight": "bold", "align": "center", "margin": "sm", "color": "#222222" }, { "type": "separator", "margin": "lg" }, { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [ { "type": "text", "text": "Product Shop", "size": "sm", "weight": "bold", "color": "#666666", "flex": 3 }, { "type": "text", "text": "Price Shop", "size": "sm", "weight": "bold", "color": "#666666", "align": "end", "flex": 2 } ] } ].concat(itemContents).concat([ { "type": "separator", "margin": "lg" }, { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [ { "type": "text", "text": "Discount", "size": "sm", "color": "#666666", "flex": 2 }, { "type": "text", "text": "- " + totals.totalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " THB", "size": "sm", "color": "#666666", "align": "end", "flex": 3 } ] }, { "type": "box", "layout": "horizontal", "margin": "sm", "contents": [ { "type": "text", "text": "VAT 7%", "size": "sm", "color": "#666666", "flex": 2 }, { "type": "text", "text": totals.tax.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " THB", "size": "sm", "color": "#666666", "align": "end", "flex": 3 } ] }, { "type": "separator", "margin": "lg" }, { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [ { "type": "text", "text": "Total", "size": "md", "weight": "bold", "color": "#000000", "flex": 2 }, { "type": "text", "text": receiptData.total.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " THB", "size": "md", "weight": "bold", "color": "#000000", "align": "end", "flex": 3 } ] } ]) } };

  var downloadItems = (receiptData.items || []).filter(function(item) { return item.downloadUrl && item.downloadUrl.trim() !== ''; });
  var downloadContents = [];
  if (downloadItems.length > 0) {
    downloadItems.forEach(function(item) {
      downloadContents.push({ "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": item.name, "size": "sm", "color": "#AAAAAA", "flex": 4, "wrap": true }, { "type": "image", "url": "https://cdn-icons-png.freepik.com/512/189/189249.png", "size": "20px", "aspectMode": "cover", "action": { "type": "uri", "label": "Download Now", "uri": item.downloadUrl } } ], "paddingAll": "10px", "backgroundColor": "#F3F4F6", "cornerRadius": "8px", "margin": "sm" });
    });
  } else {
    downloadContents.push({ "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": "ไม่มีไฟล์สำหรับดาวน์โหลด", "size": "sm", "color": "#AAAAAA", "flex": 4, "align": "center" }], "paddingAll": "10px", "backgroundColor": "#F3F4F6", "cornerRadius": "8px", "margin": "sm" });
  }
  var downloadBubble = { "type": "bubble", "size": "mega", "body": { "type": "box", "layout": "vertical", "paddingAll": "0px", "backgroundColor": "#F6F8FB", "contents": [ { "type": "box", "layout": "vertical", "paddingAll": "24px", "backgroundColor": "#E8F2FF", "contents": [{ "type": "image", "url": "https://cdn-icons-png.flaticon.com/512/847/847969.png", "aspectMode": "cover", "size": "40px", "align": "center", "margin": "md" }] }, { "type": "box", "layout": "vertical", "paddingAll": "20px", "backgroundColor": "#FFFFFF", "contents": [ { "type": "text", "text": "Download File", "weight": "bold", "size": "lg", "align": "center", "color": "#222222" }, { "type": "text", "text": "Username", "size": "sm", "weight": "bold", "margin": "lg" }, { "type": "box", "layout": "horizontal", "contents": [{ "type": "text", "text": receiptData.displayName, "size": "sm", "color": "#AAAAAA", "flex": 4 }], "paddingAll": "10px", "backgroundColor": "#F3F4F6", "cornerRadius": "8px", "margin": "sm" }, { "type": "text", "text": "Download File", "size": "sm", "weight": "bold", "margin": "lg" } ].concat(downloadContents) } ] } };

  if (!receiptData.items || receiptData.items.length === 0) {
    return { type: 'flex', altText: 'ไม่พบข้อมูลใบเสร็จ', contents: { type: "bubble", body: { type:"box", layout:"vertical", contents:[{type:"text", text: "ไม่สามารถสร้างใบเสร็จได้เนื่องจากไม่มีรายการสินค้า", align:"center", wrap: true}] } } };
  }
  return { type: 'flex', altText: 'ใบเสร็จรับเงิน ' + receiptData.receiptId, contents: { type: 'carousel', contents: [receiptBubble, downloadBubble] } };
}

function generateStatementFlex(displayName, totalAmount, pointTotal, creditTotal, transactions) {
  var transactionContents = [];
  if (transactions.length > 0) {
    transactions.forEach(function(tx) {
      var iconUrl = tx.bank && tx.bank.toLowerCase().includes('wallet') ? "https://img5.pic.in.th/file/secure-sv1/IMG_0195.png" : "https://www.bot.or.th/content/dam/bot/icons/icon-thaiqr.png";
      var backgroundColor = tx.bank && tx.bank.toLowerCase().includes('wallet') ? "#FF6600" : "#003366";
      var date = new Date(tx.date);
      var formattedDateTime = ('0' + date.getDate()).slice(-2) + '/' + ('0' + (date.getMonth() + 1)).slice(-2) + '/' + date.getFullYear() + ' : ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ' น.';
      var amountComponent = { "type": "box", "layout": "vertical", "alignItems": "flex-end", "flex": 2, "contents": [ { "type": "text", "text": tx.amount.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}), "align": "end", "weight": "bold", "size": "md", "color": "#FFFFFF" }, { "type": "text", "text": "สำเร็จ", "align": "end", "size": "xxs", "color": "#4CAF50" } ] };
      transactionContents.push({ "type": "box", "layout": "horizontal", "backgroundColor": backgroundColor, "cornerRadius": "12px", "paddingAll": "10px", "margin": "md", "alignItems": "center", "contents": [ { "type": "image", "url": iconUrl, "size": "50px", "flex": 0 }, { "type": "box", "layout": "vertical", "flex": 3, "margin": "md", "contents": [ { "type": "text", "text": tx.itemName || "Payment List", "weight": "bold", "size": "sm", "color": "#FFFFFF" }, { "type": "text", "text": tx.item || "N/A", "size": "xs", "color": "#E0E0E0" }, { "type": "text", "text": formattedDateTime, "size": "xxs", "color": "#B0C4DE", "margin": "sm" } ]}, amountComponent ] });
    });
  } else {
    transactionContents.push({ "type": "text", "text": "ไม่พบประวัติการทำรายการ", "color": "#9BAEC8", "align": "center", "size": "sm", "margin": "lg" });
  }
  return { type: 'flex', altText: 'Statement Account ของคุณ ' + displayName, contents: { "type": "bubble", "size": "giga", "body": { "type": "box", "layout": "vertical", "paddingAll": "16px", "backgroundColor": "#0D1B2A", "contents": [ { "type": "text", "text": "Statement Account", "weight": "bold", "size": "xl", "color": "#FFFFFF" }, { "type": "text", "text": displayName, "color": "#3A7BD5", "size": "sm", "margin": "md" }, { "type": "box", "layout": "baseline", "margin": "xxl", "spacing": "sm", "contents": [ { "type": "text", "text": totalAmount.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}), "weight": "bold", "size": "xxl", "color": "#FFFFFF", "flex": 0, "align": "start" }, { "type": "text", "text": "THB", "size": "sm", "color": "#9BAEC8", "weight": "bold", "gravity": "bottom", "flex": 0, "margin": "sm" } ] }, { "type": "box", "layout": "horizontal", "margin": "lg", "spacing": "md", "contents": [ { "type": "box", "layout": "vertical", "backgroundColor": "#1B263B", "cornerRadius": "12px", "paddingAll": "12px", "flex": 1, "contents": [ { "type": "text", "text": pointTotal.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}), "weight": "bold", "size": "lg", "align": "center", "color": "#FFFFFF" }, { "type": "text", "text": "Point Total", "size": "sm", "color": "#9BAEC8", "align": "center" } ] }, { "type": "box", "layout": "vertical", "backgroundColor": "#1B263B", "cornerRadius": "12px", "paddingAll": "12px", "flex": 1, "contents": [ { "type": "text", "text": creditTotal.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}), "weight": "bold", "size": "lg", "align": "center", "color": "#FFFFFF" }, { "type": "text", "text": "Credit Total", "size": "sm", "color": "#9BAEC8", "align": "center" } ] } ] }, { "type": "separator", "margin": "lg", "color": "#415A77" }, { "type": "box", "layout": "vertical", "margin": "lg", "spacing": "none", "contents": transactionContents }, { "type": "separator", "margin": "lg", "color": "#415A77" }, { "type": "text", "text": "Statement จะอัพเดทอัตโนมัติในเวลา 00:00 ของทุกวัน", "color": "#9BAEC8", "align": "center", "size": "xxs", "margin": "lg", "wrap": true } ] } } };
}

function generatePaymentSelectionFlex(amount, paymentId) {
  var flex = {
    "type": "bubble",
    "body": {
      "type": "box", "layout": "vertical",
      "contents": [
        { "type": "box", "layout": "baseline", "contents": [ { "type": "text", "text": "ยอดที่ต้องชำระ:", "weight": "bold", "size": "sm", "color": "#111111", "flex": 0 }, { "type": "text", "text": amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท", "size": "sm", "color": "#111111", "align": "end" } ] },
        { "type": "separator", "margin": "md", "color": "#DDDDDD" },
        { "type": "box", "layout": "vertical", "backgroundColor": "#0A0A23", "cornerRadius": "4px", "paddingAll": "8px", "margin": "md", "contents": [ { "type": "text", "text": "เลือกช่องทางการชำระค่าบริการ", "weight": "bold", "size": "sm", "align": "center", "color": "#FFFFFF" } ] },
        { "type": "box", "layout": "horizontal", "margin": "md", "spacing": "md", "contents": [ { "type": "text", "text": "●", "size": "sm", "color": "#333399", "flex": 0, "gravity": "center" }, { "type": "text", "text": "บัญชี พร้อมเพย์", "size": "sm", "flex": 2, "gravity": "center" }, { "type": "image", "url": "https://noveba.com/wp-content/uploads/2025/06/promtpay-qr.png", "size": "xs", "align": "end", "gravity": "center" } ], "action": { "type": "message", "label": "PromptPay", "text": "PromptPay" + paymentId } },
        { "type": "box", "layout": "horizontal", "margin": "md", "spacing": "md", "contents": [ { "type": "text", "text": "●", "size": "sm", "color": "#FF6600", "flex": 0, "gravity": "center" }, { "type": "text", "text": "บัญชี ทรูมันนี่ วอลเล็ท", "size": "sm", "flex": 2, "gravity": "center" }, { "type": "image", "url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrn-PrFVHM0k8Oe8Z7dQN0tn4StXFstYbr9fYZDtMp-uyeagIn1k6yA_I&s=10", "size": "xs", "align": "end", "gravity": "center" } ], "action": { "type": "message", "label": "TrueMoney", "text": "TrueMoney" + paymentId } }
      ]
    }
  };
  return { type: 'flex', altText: 'เลือกช่องทางการชำระเงิน', contents: flex };
}

function generatePaymentFlex(totalAmount, qrCodeUrl, headerColor, title, addQuickReply) {
  var formattedTimestamp = new Date().toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
  var formattedAmount = totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท";
  var logoUrl = title.includes('TrueMoney') ? "https://img5.pic.in.th/file/secure-sv1/IMG_0195.png" : "https://www.designil.com/wp-content/uploads/2020/04/prompt-pay-logo.png";

  var flexMessage = { type: 'flex', altText: 'รายการชำระเงินของคุณ ยอด ' + totalAmount.toLocaleString('th-TH') + ' บาท', contents: { "type": "bubble", "header": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": title, "color": "#FFFFFF", "align": "center", "weight":"bold" } ], "backgroundColor": headerColor }, "body": { "type": "box", "layout": "vertical", "spacing": "md", "contents": [ { "type": "box", "layout": "vertical", "contents": [ { "type": "image", "url": logoUrl, "size": "xs", "aspectMode":"fit", "margin":"xs"}, { "type": "image", "url": qrCodeUrl, "aspectMode": "cover", "size": "lg", "margin": "md" } ], "paddingAll": "none" }, { "type": "box", "layout": "vertical", "margin": "lg", "spacing": "sm", "contents": [ { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "วันที่ เวลา : ", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": formattedTimestamp, "wrap": true, "color": "#666666", "size": "sm", "flex": 4 } ] }, { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "ยอดเงินสุทธิ :", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": formattedAmount, "wrap": true, "color": "#0C5F00", "size": "sm", "flex": 4, "weight": "bold" } ] } ] } ] }, "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [ { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "⚡ มั่นใจทุกการชำระ ดูแลความปลอดภัยของคุณ", "color": "#ffffff", "size": "xxs", "margin": "xs", "align": "center", "wrap": true }, { "type": "text", "text": "แจ้งสลีปทุกครั้งเพื่อยืนยันรายการ", "color": "#FFFFFF", "size": "xxs", "align": "center", "wrap": true, "margin": "sm" } ] } ], "backgroundColor": headerColor, "paddingAll": "md" } } };

  if (addQuickReply) { flexMessage.quickReply = { items: [{ type: 'action', imageUrl: 'https://www.cheddarup.com/wp-content/uploads/2021/02/HOA_Illustration.gif', action: { type: 'message', label: 'ตรวจสอบสถานะ', text: 'สถานะการชำระ' } }] }; }
  return flexMessage;
}

function generateAdminConfirmationFlex(paymentType, amount, displayName, paymentId) {
  var formattedAmount = amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " THB";
  var isTrueMoney = paymentType.toLowerCase().includes('truemoney');
  var imageUrl = isTrueMoney ? "https://img5.pic.in.th/file/secure-sv1/IMG_0195.png" : "https://www.designil.com/wp-content/uploads/2020/04/prompt-pay-logo.png";
  var title = isTrueMoney ? "PAYMENT TRUE MONEY WALLET" : "PAYMENT PROMPTPAY";
  var flex = { "type": "bubble", "size": "mega", "body": { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "paddingAll": "16px", "contents": [ { "type": "image", "url": imageUrl, "size": "lg", "aspectMode": "fit", "align": "center" }, { "type": "text", "text": title, "weight": "bold", "size": "md", "align": "center", "margin": "md", "color": "#000000" }, { "type": "text", "text": "จำนวนเงิน : " + formattedAmount, "wrap": true, "size": "sm", "align": "center", "color": "#666666" }, { "type": "box", "layout": "vertical", "backgroundColor": "#F0F0F0", "cornerRadius": "6px", "paddingAll": "8px", "margin": "lg", "contents": [ { "type": "text", "text": displayName, "wrap": true, "size": "xs", "color": "#999999", "align": "center" } ] }, { "type": "box", "layout": "horizontal", "spacing": "md", "margin": "xl", "contents": [ { "type": "button", "style": "primary", "color": "#33CC00", "action": { "type": "message", "label": "CONFIRM", "text": "CONFIRM " + paymentId }, "gravity": "center", "height": "sm" }, { "type": "button", "style": "secondary", "action": { "type": "message", "label": "CANCEL PAY", "text": "CANCEL PAY " + paymentId }, "height": "sm" } ] } ] } };
  return { type: 'flex', altText: 'ยืนยันการชำระเงิน', contents: flex };
}

function generateAdminReplyFlex(isSuccess, amount, displayName) {
  var formattedAmount = amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " THB";
  var flex = isSuccess ? { "type": "bubble", "size": "mega", "body": { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "paddingAll": "16px", "contents": [ { "type": "image", "url": "https://png.pngtree.com/png-vector/20240515/ourmid/pngtree-payment-confirmation-icon-vector-logo-png-image_12462169.png", "size": "lg", "aspectMode": "fit", "align": "center" }, { "type": "text", "text": "CONFIRM SUCCESS", "weight": "bold", "size": "md", "align": "center", "margin": "md", "color": "#000000" }, { "type": "text", "text": "จำนวนเงิน : " + formattedAmount, "wrap": true, "size": "sm", "align": "center", "color": "#666666" }, { "type": "box", "layout": "vertical", "backgroundColor": "#F0F0F0", "cornerRadius": "6px", "paddingAll": "8px", "margin": "lg", "contents": [ { "type": "text", "text": displayName, "wrap": true, "size": "xs", "color": "#999999", "align": "center" } ] }, { "type": "box", "layout": "horizontal", "spacing": "md", "margin": "xl", "contents": [ { "type": "text", "text": "ส่งสถานะยืนยันชำระเงินสำเร็จ", "wrap": true, "size": "sm", "align": "center", "color": "#666666" } ] } ] } } : { "type": "bubble", "size": "mega", "body": { "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "12px", "paddingAll": "16px", "contents": [ { "type": "image", "url": "https://img2.pic.in.th/pic/IMG_03951fd96b3c53c8b490.png", "size": "xl", "aspectMode": "fit", "align": "center" }, { "type": "text", "text": "CANCEL SUCCESS", "weight": "bold", "size": "md", "align": "center", "margin": "md", "color": "#000000" }, { "type": "text", "text": "จำนวนเงิน : " + formattedAmount, "wrap": true, "size": "sm", "align": "center", "color": "#666666" }, { "type": "box", "layout": "vertical", "backgroundColor": "#F0F0F0", "cornerRadius": "6px", "paddingAll": "8px", "margin": "lg", "contents": [ { "type": "text", "text": displayName, "wrap": true, "size": "xs", "color": "#999999", "align": "center" } ] }, { "type": "box", "layout": "horizontal", "spacing": "md", "margin": "xl", "contents": [ { "type": "text", "text": "ส่งสถานะยืนยันชำระเงินไม่สำเร็จ สำเร็จ", "wrap": true, "size": "sm", "align": "center", "color": "#666666" } ] } ] } };
  return { type: 'flex', altText: 'ผลการยืนยัน', contents: flex };
}

function generatePaymentStatusFlex(paymentData) {
    var settings = getSettings();
    var isTrueMoney = paymentData.paymentType.toLowerCase().includes('truemoney');
    var status, statusColor, note, altText;

    if (paymentData.isSuccess) { status = "ชำระเงินสำเร็จ"; statusColor = "#00CC00"; note = "ตรวจสอบสำเร็จ : ยืนยันการชำระเงินแล้ว"; altText = "สถานะ: ชำระเงินสำเร็จ"; }
    else if (paymentData.isUnsuccess) { status = "ชำระเงินไม่สำเร็จ"; statusColor = "#FF0000"; note = "ตรวจสอบไม่สำเร็จ : ไม่พบสลีปที่ชำระ"; altText = "สถานะ: ชำระเงินไม่สำเร็จ"; }
    else { status = "รอดำเนินการ"; statusColor = "#FF6600"; note = "รอชำระ หรือ อยู่ระหว่างการตรวจสอบ"; altText = "สถานะ: รอดำเนินการ"; }

    var flex = { "type": "bubble", "body": { "type": "box", "layout": "vertical", "spacing": "md", "contents": [ { "type": "box", "layout": "horizontal", "alignItems": "center", "contents": [ { "type": "image", "url": isTrueMoney ? "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrn-PrFVHM0k8Oe8Z7dQN0tn4StXFstYbr9fYZDtMp-uyeagIn1k6yA_I&s=10" : "https://noveba.com/wp-content/uploads/2025/06/promtpay-qr.png", "size": "xs", "align": "start", "gravity": "center", "margin": "sm" }, { "type": "text", "text": isTrueMoney ? "บัญชี TrueMoney Wallet" : "บัญชี PromptPay", "weight": "bold", "size": "md", "margin": "md", "align": "start", "flex": 4 } ] }, { "type": "text", "text": "หมายเลขบัญชีรับเงิน", "size": "sm", "color": "#555555", "margin": "md" }, { "type": "box", "layout": "vertical", "borderWidth": "1px", "borderColor": "#E0E0E0", "cornerRadius": "6px", "backgroundColor": "#FFFFFF", "paddingAll": "12px", "contents": [ { "type": "text", "text": maskAccountNumber(isTrueMoney ? settings.trueMoneyNumber : settings.promptPayId), "size": "sm", "color": "#111111" } ] }, { "type": "text", "text": "จำนวนเงิน", "size": "sm", "color": "#555555", "margin": "md" }, { "type": "box", "layout": "vertical", "borderColor": "#E0E0E0", "borderWidth": "0px", "paddingAll": "6px", "contents": [ { "type": "text", "text": paymentData.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "align": "end", "weight": "bold", "size": "md", "color": "#111111" } ] }, { "type": "box", "layout": "vertical", "backgroundColor": "#F5F5F5", "paddingAll": "8px", "contents": [ { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": "สถานะการชำระเงิน :", "size": "xs", "color": "#555555" }, { "type": "text", "text": status, "size": "xs", "weight": "bold", "color": statusColor, "margin": "sm", "flex": 1 } ] } ] }, { "type": "text", "text": "หมายเหตุ*", "size": "sm", "color": "#555555", "margin": "md" }, { "type": "box", "layout": "vertical", "borderWidth": "1px", "borderColor": "#E0E0E0", "cornerRadius": "6px", "backgroundColor": "#FFFFFF", "paddingAll": "12px", "contents": [ { "type": "text", "text": note, "size": "sm", "color": "#AAAAAA" } ] } ] } };
    return { type: 'flex', altText: altText, contents: flex };
}

function generateMyOrdersFlex(orders, displayName) {
    if (!orders || orders.length === 0) {
        return {
            type: 'flex',
            altText: 'ไม่พบประวัติการสั่งซื้อ',
            contents: {
                type: 'bubble',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        { type: 'text', text: 'ไม่พบประวัติการสั่งซื้อ', align: 'center', weight: 'bold' },
                        { type: 'text', text: 'คุณยังไม่เคยสั่งซื้อสินค้าค่ะ', align: 'center', size: 'sm', margin: 'md', wrap: true }
                    ]
                }
            }
        };
    }

    var bubbles = orders.slice(0, 10).map(function(order) { // แสดงผลสูงสุด 10 รายการล่าสุด
        var statusColor = "#FFA500"; // รอชำระเงิน
        if (order.status === 'ชำระเงินแล้ว') {
            statusColor = "#32CD32"; // เขียว
        } else if (order.status === 'ชำระเงินไม่สำเร็จ') {
            statusColor = "#FF6347"; // แดง
        }

        var itemsSummary = 'ไม่มีข้อมูลสินค้า';
        try {
            var items = JSON.parse(order.itemsJson);
            itemsSummary = items.map(function(item) {
                return '• ' + item.name + ' (x' + item.quantity + ')';
            }).join('\n');
        } catch (e) {
            Logger.log('Could not parse items for orderId ' + order.orderId);
        }

        return {
            "type": "bubble",
            "size": "giga",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    { "type": "text", "text": "ORDER ID", "color": "#ffffff", "size": "sm" },
                    { "type": "text", "text": order.orderId, "color": "#ffffff", "size": "lg", "weight": "bold" }
                ],
                "backgroundColor": "#273444",
                "paddingAll": "20px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "paddingAll": "20px",
                "contents": [
                    {
                        "type": "box",
                        "layout": "baseline",
                        "contents": [
                            { "type": "text", "text": "วันที่:", "flex": 2, "size": "sm", "color": "#aaaaaa" },
                            { "type": "text", "text": new Date(order.date).toLocaleString('th-TH'), "flex": 4, "size": "sm", "wrap": true }
                        ]
                    },
                    {
                        "type": "box",
                        "layout": "baseline",
                        "contents": [
                            { "type": "text", "text": "สถานะ:", "flex": 2, "size": "sm", "color": "#aaaaaa" },
                            { "type": "text", "text": order.status, "flex": 4, "size": "sm", "weight": "bold", "color": statusColor }
                        ]
                    },
                    { "type": "separator", "margin": "lg" },
                    { "type": "text", "text": "รายการสินค้า", "weight": "bold", "margin": "lg" },
                    { "type": "text", "text": itemsSummary, "wrap": true, "size": "sm", "margin": "sm", "color": "#666666" },
                    { "type": "separator", "margin": "lg" },
                    {
                        "type": "box",
                        "layout": "baseline",
                        "margin": "lg",
                        "contents": [
                            { "type": "text", "text": "ยอดรวมสุทธิ", "weight": "bold" },
                            { "type": "text", "text": order.total.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + " บาท", "align": "end", "weight": "bold", "color": "#B22222" }
                        ]
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                     {
                        "type": "button",
                        "action": { "type": "message", "label": "ดูใบเสร็จล่าสุด", "text": "ใบเสร็จ" },
                        "style": "primary",
                        "height": "sm",
                        "color": "#1E90FF",
                        "margin": "sm"
                    }
                ]
            }
        };
    });

    return {
        type: 'flex',
        altText: 'ประวัติการสั่งซื้อของคุณ ' + displayName,
        contents: {
            type: 'carousel',
            contents: bubbles
        }
    };
}

/********************************************************************************
* ฟังก์ชันพื้นฐานและ Helper อื่นๆ
********************************************************************************/
function handleImageMessage(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;

  var cache = CacheService.getScriptCache();
  var repairState = cache.get('repair_state_' + userId);
  
  if (repairState === 'awaiting_photo_or_skip') {
    try {
      var imageBlob = getImage(event.message.id);
      var fileUrl = saveImageToDrive(imageBlob);
      if (fileUrl) {
        var repairDataJson = cache.get('repair_data_' + userId);
        var repairData = repairDataJson ? JSON.parse(repairDataJson) : {};
        repairData.photoUrl = fileUrl;

        cache.put('repair_data_' + userId, JSON.stringify(repairData), 900);
        cache.put('repair_state_' + userId, 'awaiting_confirmation', 900);

        var confirmationFlex = generateRepairConfirmationFlex(repairData);
        reply(replyToken, [confirmationFlex], settings.botConnect);
      } else {
        reply(replyToken, [{ type: 'text', text: 'ขออภัยค่ะ เกิดข้อผิดพลาดในการบันทึกรูปภาพ กรุณาลองใหม่อีกครั้ง' }], settings.botConnect);
      }
    } catch (e) {
      Logger.log('Error processing repair image: ' + e.stack);
      reply(replyToken, [{ type: 'text', text: 'ไม่สามารถประมวลผลรูปภาพได้ค่ะ' }], settings.botConnect);
    }
    return;
  }

  var userProfile = getProfile(userId);
  var displayName = userProfile.displayName;
  logNewUser(userId, displayName);
  try {
    var imageBlob = getImage(event.message.id);
    var fileName = imageBlob.getName();
    var fileUrl = saveImageToDrive(imageBlob);
    if (fileUrl) {
      logToSheet('Images', [new Date(), userId, displayName, fileName, fileUrl]);
      var flexMessage = buildImageReplyFlex_Success(fileName, fileUrl);
      reply(replyToken, [flexMessage], settings.botConnect);
    } else {
      reply(replyToken, [{ type: 'text', text: 'เกิดข้อผิดพลาดในการบันทึกรูปภาพ' }], settings.botConnect);
    }
  } catch (e) {
    Logger.log(e);
    reply(replyToken, [{ type: 'text', text: 'ขออภัย, ไม่สามารถประมวลผลรูปภาพได้ในขณะนี้' }], settings.botConnect);
  }
}
function buildImageReplyFlex_Success(fileName, fileUrl) {
  var settings = getSettings();
  if (!settings) return;
  var folderName = 'IMAGE USER.File'; try { var folder = DriveApp.getFolderById(settings.folderId); folderName = folder.getName(); } catch(e) {}
  var flexObject = {"type": "bubble", "body": {"type": "box", "layout": "vertical", "spacing": "md", "contents": [{"type": "text", "text": "Save File Success", "size": "xl", "weight": "bold", "flex": 2, "margin": "md"}, {"type": "box", "layout": "vertical", "spacing": "sm", "contents": [{"type": "box", "layout": "baseline", "contents": [{"type": "icon", "url": "https://cdn-icons-png.flaticon.com/512/4706/4706330.png"}, {"type": "text", "text": "File Name", "weight": "bold", "margin": "sm", "flex": 0}, {"type": "text", "text": fileName, "size": "sm", "align": "end", "color": "#aaaaaa", "wrap": true}]}, {"type": "box", "layout": "baseline", "contents": [{"type": "icon", "url": "https://static.vecteezy.com/system/resources/previews/012/871/368/non_2x/google-drive-icon-google-product-illustration-free-png.png"}, {"type": "text", "text": "Folder", "weight": "bold", "margin": "sm", "flex": 0}, {"type": "text", "text": folderName, "size": "sm", "align": "end", "color": "#aaaaaa"}]}]}, {"type": "text", "text": "สามารถดาวน์โหลดไฟล์ได้ที่ปุ่ม Download", "wrap": true, "color": "#aaaaaa", "size": "xxs"}]}, "footer": {"type": "box", "layout": "vertical", "contents": [{"type": "button", "style": "primary", "color": "#FF0000", "margin": "xxl", "action": {"type": "uri", "label": "📥 DOWNLOAD FILE", "uri": fileUrl}}]}};
  return { type: 'flex', altText: 'บันทึกไฟล์เรียบร้อยแล้ว: ' + fileName, contents: flexObject };
}

function reply(replyToken, messages, sender) {
  var settings = getSettings();
  if (!settings) return;
  var messagesWithSender = messages.map(function(msg) { if (sender) { msg.sender = sender; } return msg; });
  var payload = {'replyToken': replyToken, 'messages': messagesWithSender};
  var options = { 'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + settings.accessToken }, 'method': 'post', 'payload': JSON.stringify(payload) };
  try { UrlFetchApp.fetch(REPLY_URL, options); } catch(e) { Logger.log(e.stack); }
}

function pushMessage(userId, messages, sender) {
  var settings = getSettings();
  if (!settings) return;
  var messageSender = sender || settings.payConnect;
  var messagesWithSender = messages.map(function(msg) { if (messageSender) { msg.sender = messageSender; } return msg; });
  var payload = { 'to': userId, 'messages': messagesWithSender };
  var options = { 'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + settings.accessToken }, 'method': 'post', 'payload': JSON.stringify(payload) };
  try { UrlFetchApp.fetch(PUSH_URL, options); } catch(e) { Logger.log('Push Message failed for user ' + userId + ': ' + e.stack); }
}

function getProfile(userId) {
  var settings = getSettings();
  if (!settings) return { displayName: 'ผู้ใช้' };
  try {
    var response = UrlFetchApp.fetch(PROFILE_URL + userId, { 'headers': { 'Authorization': 'Bearer ' + settings.accessToken } });
    return JSON.parse(response.getContentText());
  } catch(e) { return { displayName: 'ผู้ใช้' }; }
}

function findInSheet(sheet, keyword) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim().toLowerCase() === keyword.toLowerCase()) { return data[i]; }
  }
  return null;
}

function logNewUser(userId, displayName) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data');
  if (!sheet) return;
  if (!findUserInDataSheet(userId)) { sheet.appendRow([new Date(), userId, displayName, '']); }
}

function findUserInDataSheet(userId) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data');
    if (!sheet || sheet.getLastRow() < 2) return null;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][1] === userId) { return { row: i + 2, timestamp: data[i][0], userId: data[i][1], displayName: data[i][2], status: data[i][3] }; }
    }
    return null;
  } catch(e) { Logger.log("Error in findUserInDataSheet: " + e.stack); return null; }
}

function logToSheet(sheetName, dataArray) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (sheet) { sheet.appendRow(dataArray); }
  } catch (e) { Logger.log('Error logging to Sheet ' + sheetName + ': ' + e.stack); }
}

function clearAllCache(userId) {
  var cache = CacheService.getScriptCache();
  cache.remove('payment_state_' + userId);
  cache.remove('user_flow_' + userId);
  cache.remove('cart_' + userId);
  cache.remove('orderId_' + userId);
  cache.remove('temp_payment_' + userId);
  // Clear booking cache as well
  cache.remove('booking_state_' + userId);
  cache.remove('booking_data_' + userId);
  // Clear repair cache
  cache.remove('repair_state_' + userId);
  cache.remove('repair_data_' + userId);
}

function showLoadingAnimation(userId, seconds) {
  var settings = getSettings();
  if (!settings || !settings.accessToken) return;
  try {
    var options = {
      'headers': { 'Authorization': 'Bearer ' + settings.accessToken, 'Content-Type': 'application/json' },
      'method': 'post', 'payload': JSON.stringify({'chatId': userId, 'loadingSeconds': seconds})
    };
    UrlFetchApp.fetch(LOADING_URL, options);
  } catch(e) {
    Logger.log('Loading Animation failed: ' + e.stack);
  }
}

function getImage(messageId) {
  var settings = getSettings();
  if (!settings) return;
  var url = IMAGE_CONTENT_URL + messageId + '/content';
  var response = UrlFetchApp.fetch(url, {headers: {'Authorization': 'Bearer ' + settings.accessToken}, method: 'get'});
  return response.getBlob().getAs('image/png').setName(new Date().getTime() + '.png');
}

function saveImageToDrive(blob) {
  var settings = getSettings();
  if (!settings) return false;
  try {
    var folder = DriveApp.getFolderById(settings.folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) { Logger.log('Error saving to Drive: ' + e.stack); return false; }
}

function generatePromptPayPayload(id, amount) {
  const ID_PAYLOAD_FORMAT = '00'; const ID_POI_METHOD = '01'; const ID_MERCHANT_INFO = '29'; const ID_TRANSACTION_CURRENCY = '53'; const ID_TRANSACTION_AMOUNT = '54'; const ID_COUNTRY_CODE = '58'; const ID_CRC = '63';
  function formatTLV(tag, value) { const valueStr = String(value); const len = ('00' + valueStr.length).slice(-2); return tag + len + valueStr; }
  function crc16(data) { let crc = 0xFFFF; for (let i = 0; i < data.length; i++) { crc ^= data.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) { crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1; } } return ('0000' + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4); }
  let merchantIdType; if (/^0\d{9}$/.test(id)) { merchantIdType = '01'; } else if (/^\d{13}$/.test(id)) { merchantIdType = '02'; } else { merchantIdType = '03'; }
  let payload = ''; payload += formatTLV(ID_PAYLOAD_FORMAT, '01'); const poiMethod = (amount && amount > 0) ? '12' : '11'; payload += formatTLV(ID_POI_METHOD, poiMethod);
  const merchantInfo = formatTLV('00', 'A000000677010111') + formatTLV(merchantIdType, id); payload += formatTLV(ID_MERCHANT_INFO, merchantInfo);
  payload += formatTLV(ID_COUNTRY_CODE, 'TH'); payload += formatTLV(ID_TRANSACTION_CURRENCY, '764');
  if (poiMethod === '12') { payload += formatTLV(ID_TRANSACTION_AMOUNT, amount.toFixed(2)); }
  const crcTagAndLength = ID_CRC + '04';
  const dataForCrc = payload + crcTagAndLength;
  const crcValue = crc16(dataForCrc);
  return dataForCrc + crcValue;
}

function maskAccountNumber(accountNumber) {
  if (typeof accountNumber !== 'string' || accountNumber.length <= 7) { return accountNumber; }
  return accountNumber.substring(0, 3) + "-XXX-" + accountNumber.substring(accountNumber.length - 4);
}

function getAdmins() {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ADMIN');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
    return data.map(function(row) { return row[0]; }).filter(Boolean);
  } catch(e) {
    Logger.log("Error in getAdmins: " + e.stack);
    return [];
  }
}

function getTotalUserCount() {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data');
    if (!sheet || sheet.getLastRow() < 2) return 0;
    var data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    var uniqueUserIds = {};
    data.forEach(function(row) {
      if (row[0]) {
        uniqueUserIds[row[0]] = true;
      }
    });
    return Object.keys(uniqueUserIds).length;
  } catch(e) {
    Logger.log("Error in getTotalUserCount: " + e.stack);
    return 0;
  }
}

function findPaymentById(paymentId) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Payments');
    if (!sheet || sheet.getLastRow() < 2) return null;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      if (data[i][11] && data[i][11].toString().trim() === paymentId) {
        return {
          displayName: data[i][2],
          amount: parseFloat(data[i][5]),
          paymentType: data[i][8]
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log("Error in findPaymentById: " + e.stack);
    return null;
  }
}

/********************************************************************************
 * ระบบจองคิว (Booking System)
 ********************************************************************************/
function startBookingFlow(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var settings = getSettings();
    if (!settings) return;
    var cache = CacheService.getScriptCache();

    cache.put('user_flow_' + userId, 'booking', 900); // Lock flow for 15 mins
    cache.put('booking_state_' + userId, 'awaiting_phone', 900);

    var message = {
        type: 'text',
        text: 'กรุณาพิมพ์เบอร์โทรศัพท์ 10 หลัก เพื่อใช้ในการติดต่อและยืนยันการจองค่ะ'
    };
    reply(replyToken, [message], settings.botConnect);
}

function handleBookingState(event, state) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var userMessage = event.message.text.trim();
    var userMessageLower = userMessage.toLowerCase();
    var settings = getSettings();
    if (!settings) return;
    var cache = CacheService.getScriptCache();
    var bookingDataJson = cache.get('booking_data_' + userId);
    var bookingData = bookingDataJson ? JSON.parse(bookingDataJson) : {};

    if (state === 'awaiting_phone') {
        if (/^\d{10}$/.test(userMessage)) {
            bookingData.phone = userMessage;
            cache.put('booking_data_' + userId, JSON.stringify(bookingData), 900);
            cache.put('booking_state_' + userId, 'awaiting_service', 900);
            
            var flexMessage = generateServiceSelectionFlex();
            if(flexMessage){
                reply(replyToken, [flexMessage], settings.botConnect);
            } else {
                reply(replyToken, [{type: 'text', text: 'ขออภัยค่ะ ขณะนี้ยังไม่มีบริการให้เลือกจอง'}], settings.botConnect);
                clearAllCache(userId);
            }
        } else {
            reply(replyToken, [{ type: 'text', text: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง กรุณาพิมพ์เบอร์โทรศัพท์ 10 หลักอีกครั้งค่ะ' }], settings.botConnect);
        }
    } else if (state === 'awaiting_service') {
        bookingData.service = userMessage;
        cache.put('booking_data_' + userId, JSON.stringify(bookingData), 900);
        cache.put('booking_state_' + userId, 'awaiting_date', 900);

        var calendarFlex = generateCalendarFlex(userMessage);
        reply(replyToken, [calendarFlex], settings.botConnect);

    } else if (state === 'awaiting_date') {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(userMessage)) {
            reply(replyToken, [{ type: 'text', text: userMessage }], settings.botConnect); 
            return;
        }

        var hasBooking = hasUserBookingOnDate(userId, userMessage);
        if (hasBooking) {
            reply(replyToken, [{ type: 'text', text: 'คุณมีการจองในวันที่ ' + userMessage + ' แล้ว กรุณาเลือกวันอื่นค่ะ' }], settings.botConnect);
            return;
        }

        bookingData.date = userMessage;
        cache.put('booking_data_' + userId, JSON.stringify(bookingData), 900);
        cache.put('booking_state_' + userId, 'awaiting_time', 900);
        
        var timeSlotsFlex = generateTimeSlotsFlex(bookingData.service, bookingData.date);
        reply(replyToken, [timeSlotsFlex], settings.botConnect);

    } else if (state === 'awaiting_time') {
        if (!/^\d{2}:\d{2}$/.test(userMessage)) {
            reply(replyToken, [{ type: 'text', text: userMessage }], settings.botConnect);
            return;
        }
        bookingData.time = userMessage;
        cache.put('booking_data_' + userId, JSON.stringify(bookingData), 900);
        cache.put('booking_state_' + userId, 'awaiting_confirmation', 900);

        var confirmationFlex = generateBookingConfirmationFlex(bookingData);
        reply(replyToken, [confirmationFlex], settings.botConnect);

    } else if (state === 'awaiting_confirmation') {
        if (userMessageLower === 'ยืนยัน') {
            var result = saveBooking(userId, bookingData);
            var confirmationMessage = generateFinalBookingReceipt(bookingData, result.queueNumber);
            reply(replyToken, [confirmationMessage], settings.botConnect);
            clearAllCache(userId);
        } else {
            reply(replyToken, [{ type: 'text', text: 'หากต้องการยืนยัน กรุณากดปุ่ม "ยืนยัน" หรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่ค่ะ' }], settings.botConnect);
        }
    }
}
function generateServiceSelectionFlex() {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ST Booking');
    if (!sheet || sheet.getLastRow() < 2) return null;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

    var serviceContents = data.map(function(row) {
        var serviceName = row[0];
        var workingDays = row[1];
        var formattedStartTime = Utilities.formatDate(new Date(row[2]), "Asia/Bangkok", "HH:mm");
        var formattedEndTime = Utilities.formatDate(new Date(row[3]), "Asia/Bangkok", "HH:mm");

        return {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#FFFFFF",
            "cornerRadius": "8px",
            "borderColor": "#E0E0E0",
            "borderWidth": "1px",
            "paddingAll": "10px",
            "spacing": "sm",
            "action": { "type": "message", "label": serviceName, "text": serviceName },
            "contents": [
                { "type": "text", "text": serviceName, "weight": "bold", "color": "#009B3A", "size": "md" },
                { "type": "text", "text": "วันทำการ : " + workingDays, "size": "xs", "color": "#666666" },
                { "type": "text", "text": "เวลาเปิด-ปิด : " + formattedStartTime + " น. ถึง " + formattedEndTime + " น.", "size": "xs", "color": "#666666" },
                { "type": "text", "text": "คลิกเพื่อเลือก", "size": "xs", "color": "#444444", "align": "end" }
            ]
        };
    });

    return {
      "type": "flex",
      "altText": "เลือกบริการที่ต้องการจอง",
      "contents": {
        "type": "bubble", "size": "giga",
        "body": {
          "type": "box", "layout": "vertical", "spacing": "md",
          "contents": [
            { "type": "text", "text": "เลือกบริการ : ทุกระดับประทับใจ", "weight": "bold", "size": "md", "color": "#000000" },
            { "type": "text", "text": "เลือกบริการที่ท่านต้องการ", "size": "sm", "color": "#666666", "margin": "sm" },
            { "type": "box", "layout": "vertical", "margin": "md", "spacing": "sm", "contents": serviceContents }
          ]
        }
      }
    };
}

function generateCalendarFlex(serviceName) {
    var today = new Date();
    today.setHours(0, 0, 0, 0); 
    var currentYear = today.getFullYear();
    var currentMonth = today.getMonth();
    var bubbles = [];

    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ST Booking');
    var services = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    var workingDaysStr = 'จ-อา'; // Default
    for (var i = 0; i < services.length; i++) {
        if (services[i][0] === serviceName) {
            workingDaysStr = services[i][1];
            break;
        }
    }
    var workingDayIndexes = parseWorkingDays(workingDaysStr);

    for (var month = currentMonth; month <= 11; month++) {
        var date = new Date(currentYear, month, 1);
        var monthName = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        var year = date.getFullYear();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDayIndex = date.getDay();

        var dayContents = [];
        var days = [];
        for (var i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        for (var i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        var weeks = [];
        while (days.length > 0) {
            weeks.push(days.splice(0, 7));
        }

        weeks.forEach(function(week) {
            var weekContents = [];
            for (var i = 0; i < 7; i++) {
                var day = week[i];
                if (day) {
                    var currentDate = new Date(year, month, day);
                    var dayIndex = currentDate.getDay();
                    var isPast = currentDate < today;
                    var isWorkingDay = workingDayIndexes.includes(dayIndex);
                    var dateString = ('0' + day).slice(-2) + '/' + ('0' + (month + 1)).slice(-2) + '/' + year;

                    if (isPast || !isWorkingDay) {
                        weekContents.push({ "type": "text", "text": day.toString(), "align": "center", "flex": 1, "color": "#CCCCCC", "action": { "type": "message", "label": day.toString(), "text": "วันที่ " + dateString + " ไม่สามารถเลือกได้" } });
                    } else {
                        weekContents.push({ "type": "text", "text": day.toString(), "align": "center", "flex": 1, "color": "#000000", "action": { "type": "message", "label": day.toString(), "text": dateString } });
                    }
                } else {
                    weekContents.push({ "type": "filler", "flex": 1 });
                }
            }
            dayContents.push({ "type": "box", "layout": "horizontal", "contents": weekContents });
        });

        var bubble = {
            "type": "bubble", "size": "giga",
            "body": {
                "type": "box", "layout": "vertical", "backgroundColor": "#FFFFFF", "cornerRadius": "16px", "paddingAll": "16px",
                "contents": [
                    { "type": "box", "layout": "horizontal", "contents": [ { "type": "text", "text": monthName, "weight": "bold", "size": "xl", "color": "#000000", "flex": 1 }, { "type": "text", "text": year.toString(), "weight": "bold", "size": "xl", "color": "#D50000" } ] },
                    { "type": "box", "layout": "horizontal", "margin": "md", "contents": [ { "type": "text", "text": "Sun", "size": "sm", "align": "center", "weight": "bold", "color": "#D50000", "flex": 1 }, { "type": "text", "text": "Mon", "size": "sm", "align": "center", "flex": 1 }, { "type": "text", "text": "Tue", "size": "sm", "align": "center", "flex": 1 }, { "type": "text", "text": "Wed", "size": "sm", "align": "center", "flex": 1 }, { "type": "text", "text": "Thu", "size": "sm", "align": "center", "flex": 1 }, { "type": "text", "text": "Fri", "size": "sm", "align": "center", "flex": 1 }, { "type": "text", "text": "Sat", "size": "sm", "align": "center", "weight": "bold", "color": "#D50000", "flex": 1 } ] },
                    { "type": "separator", "margin": "sm", "color": "#CCCCCC" },
                    { "type": "box", "layout": "vertical", "margin": "sm", "spacing": "md", "contents": dayContents }
                ]
            }
        };
        bubbles.push(bubble);
    }

    return { type: 'flex', altText: 'กรุณาเลือกวันที่', contents: { type: 'carousel', contents: bubbles } };
}

function parseWorkingDays(dayStr) {
    var dayMap = { 'อา': 0, 'จ': 1, 'อ': 2, 'พ': 3, 'พฤ': 4, 'ศ': 5, 'ส': 6 };
    var days = [];
    if (dayStr.includes('-')) {
        var parts = dayStr.split('-');
        var start = dayMap[parts[0]];
        var end = dayMap[parts[1]];
        if (start <= end) {
            for (var i = start; i <= end; i++) { days.push(i); }
        } else {
            for (var i = start; i <= 6; i++) { days.push(i); }
            for (var i = 0; i <= end; i++) { days.push(i); }
        }
    } else {
        var parts = dayStr.split(',');
        parts.forEach(function(part) { if (dayMap[part.trim()] !== undefined) days.push(dayMap[part.trim()]); });
    }
    return days;
}


function generateTimeSlotsFlex(serviceName, dateStr) {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ST Booking');
    var services = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    var startTimeStr = "09:00", endTimeStr = "17:00"; // Defaults
    for (var i = 0; i < services.length; i++) {
        if (services[i][0] === serviceName) {
            startTimeStr = Utilities.formatDate(new Date(services[i][2]), "Asia/Bangkok", "HH:mm");
            endTimeStr = Utilities.formatDate(new Date(services[i][3]), "Asia/Bangkok", "HH:mm");
            break;
        }
    }

    var bookingSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Booking');
    var bookedTimes = [];
    if (bookingSheet.getLastRow() > 1) {
        var bookings = bookingSheet.getRange(2, 1, bookingSheet.getLastRow() - 1, 8).getValues();
        var selectedDate = new Date(dateStr.split('/')[2], dateStr.split('/')[1] - 1, dateStr.split('/')[0]);

        bookings.forEach(function(booking) {
            var bookingDate = new Date(booking[5]);
            if (booking[6] === 'Confirmed' && bookingDate.toDateString() === selectedDate.toDateString()) {
                bookedTimes.push(bookingDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }));
            }
        });
    }

    var timeSlots = [];
    var current = new Date("1970-01-01T" + startTimeStr + ":00");
    var end = new Date("1970-01-01T" + endTimeStr + ":00");
    
    while (current <= end) {
        timeSlots.push(current.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }));
        current.setHours(current.getHours() + 1);
    }

    var buttonRows = [];
    while (timeSlots.length > 0) {
        var rowSlots = timeSlots.splice(0, 3);
        var buttonContents = rowSlots.map(function(time) {
            var isBooked = bookedTimes.includes(time);
            return {
                "type": "button",
                "style": isBooked ? "secondary" : "primary",
                "color": isBooked ? "#FF5252" : "#1976D2",
                "height": "sm",
                "action": { "type": "message", "label": time, "text": isBooked ? "เวลานี้ถูกจองแล้ว" : time }
            };
        });
        buttonRows.push({ "type": "box", "layout": "horizontal", "spacing": "md", "contents": buttonContents });
    }

    var flexJson = {
        "type": "bubble", "size": "giga",
        "header": { "type": "box", "layout": "vertical", "paddingAll": "16px", "contents": [ { "type": "text", "text": "กรุณาเลือกช่วงเวลา", "weight": "bold", "size": "xl", "align": "center", "color": "#1976D2" }, { "type": "text", "text": "วันที่: " + dateStr, "size": "md", "align": "center", "color": "#666666", "margin": "sm" } ], "backgroundColor": "#E3F2FD" },
        "body": { "type": "box", "layout": "vertical", "spacing": "md", "contents": buttonRows, "paddingAll": "20px" },
        "footer": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "เวลาที่ถูกจองแล้วจะแสดงเป็นสีแดง", "size": "sm", "align": "center", "color": "#AAAAAA" }] }
    };
    return { type: 'flex', altText: 'กรุณาเลือกเวลา', contents: flexJson };
}


function formatThaiDate(dateString) {
    var parts = dateString.split('/');
    var date = new Date(parts[2], parts[1] - 1, parts[0]);
    var options = { timeZone: "Asia/Bangkok", weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('th-TH', options);
}

function generateBookingConfirmationFlex(bookingData) {
    var formattedDate = formatThaiDate(bookingData.date);
    return {
      type: 'flex',
      altText: 'ยืนยันข้อมูลการจอง',
      contents: {
        "type": "bubble", "size": "giga",
        "body": { "type": "box", "layout": "vertical", "paddingAll": "16px", "contents": [
            { "type": "text", "text": "ตรวจสอบข้อมูลการจอง", "weight": "bold", "size": "md", "align": "center", "margin": "md" },
            { "type": "text", "text": "ตรวจสอบและยืนยันการจอง", "size": "sm", "color": "#666666", "align": "center", "margin": "sm" },
            { "type": "box", "layout": "vertical", "margin": "lg", "borderWidth": "1px", "borderColor": "#00B900", "cornerRadius": "8px", "paddingAll": "12px", "contents": [
                { "type": "box", "layout": "baseline", "contents": [ { "type": "icon", "url": "https://www.kasikornbank.com/SiteCollectionDocuments/personal/assets/img/need-img_3.png", "size": "md" }, { "type": "text", "text": "เบอร์โทรศัพท์", "weight": "bold", "margin": "sm" } ] },
                { "type": "text", "text": bookingData.phone, "margin": "sm" },
                { "type": "separator", "margin": "md" },
                { "type": "box", "layout": "baseline", "margin": "md", "contents": [ { "type": "icon", "url": "https://www.kasikornbank.com/SiteCollectionDocuments/personal/assets/img/product04-m.png", "size": "md" }, { "type": "text", "text": "บริการ", "weight": "bold", "margin": "sm" } ] },
                { "type": "text", "text": bookingData.service, "margin": "sm", "wrap": true },
                { "type": "separator", "margin": "md" },
                { "type": "box", "layout": "baseline", "margin": "md", "contents": [ { "type": "icon", "url": "https://www.kasikornbank.com/SiteCollectionDocuments/personal/assets/img/need-img_2.png", "size": "md" }, { "type": "text", "text": "วันที่ - เวลา", "weight": "bold", "margin": "sm" } ] },
                { "type": "text", "text": "วันที่ : " + formattedDate + "\nเวลา " + bookingData.time + " น.", "margin": "sm", "wrap": true },
              ]
            }
          ]
        },
        "footer": { "type": "box", "layout": "horizontal", "spacing": "md", "contents": [
            { "type": "button", "action": { "type": "message", "label": "ยกเลิก", "text": "ยกเลิก" }, "style": "secondary", "color": "#E0E0E0" },
            { "type": "button", "action": { "type": "message", "label": "ยืนยัน", "text": "ยืนยัน" }, "color": "#00B900", "style": "primary" }
          ]
        }
      }
    };
}

function saveBooking(userId, bookingData) {
    var userProfile = getProfile(userId);
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Booking');
    var bookingTimestamp = new Date();
    var queueNumber = 'Q' + bookingTimestamp.getTime().toString().slice(-7);

    var dateParts = bookingData.date.split('/'); // DD/MM/YYYY
    var timeParts = bookingData.time.split(':'); // HH:MM
    var bookingDateTime = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);

    sheet.appendRow([
        bookingTimestamp,
        userId,
        userProfile.displayName,
        bookingData.phone,
        bookingData.service,
        bookingDateTime,
        'Confirmed',
        queueNumber
    ]);

    return { success: true, queueNumber: queueNumber };
}


function generateFinalBookingReceipt(bookingData, queueNumber) {
  var formattedDate = formatThaiDate(bookingData.date);
  return {
    type: 'flex',
    altText: 'การจองของคุณสำเร็จแล้ว',
    contents: {
      "type": "bubble",
      "size": "giga",
      "body": {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "16px",
        "contents": [
          { "type": "text", "text": queueNumber, "weight": "bold", "size": "xl", "align": "center", "margin": "md", "color": "#00B900" },
          { "type": "text", "text": "ข้อมูลการจองของคุณ", "size": "sm", "color": "#666666", "align": "center", "margin": "sm" },
          {
            "type": "box", "layout": "vertical", "margin": "lg", "borderWidth": "1px", "borderColor": "#00B900", "cornerRadius": "8px", "paddingAll": "12px",
            "contents": [
              { "type": "box", "layout": "baseline", "contents": [ { "type": "icon", "url": "https://cdn-icons-png.flaticon.com/512/684/684908.png", "size": "sm" }, { "type": "text", "text": "เบอร์โทรศัพท์", "weight": "bold", "margin": "sm" } ] },
              { "type": "text", "text": bookingData.phone, "margin": "sm" },
              { "type": "separator", "margin": "md" },
              { "type": "box", "layout": "baseline", "margin": "md", "contents": [ { "type": "icon", "url": "https://cdn-icons-png.flaticon.com/512/84/84263.png", "size": "sm" }, { "type": "text", "text": "บริการ", "weight": "bold", "margin": "sm" } ] },
                { "type": "text", "text": bookingData.service, "margin": "sm", "wrap": true },
              { "type": "separator", "margin": "md" },
              { "type": "box", "layout": "baseline", "margin": "md", "contents": [ { "type": "icon", "url": "https://cdn-icons-png.flaticon.com/512/747/747310.png", "size": "sm" }, { "type": "text", "text": "วันที่ - เวลา", "weight": "bold", "margin": "sm" } ] },
              { "type": "text", "text": "วันที่ : " + formattedDate + "\nเวลา " + bookingData.time + " น.", "margin": "sm", "wrap": true }
            ]
          }
        ]
      }
    }
  }
}

function hasUserBookingOnDate(userId, dateStr) {
    var bookingSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Booking');
    if (bookingSheet.getLastRow() < 2) return false;
    var bookings = bookingSheet.getRange(2, 1, bookingSheet.getLastRow() - 1, 8).getValues();
    var selectedDate = new Date(dateStr.split('/')[2], dateStr.split('/')[1] - 1, dateStr.split('/')[0]);

    for (var i = 0; i < bookings.length; i++) {
        var booking = bookings[i];
        var bookingUserId = booking[1];
        var bookingDate = new Date(booking[5]);
        var status = booking[6];

        if (bookingUserId === userId && status === 'Confirmed' && bookingDate.toDateString() === selectedDate.toDateString()) {
            return true;
        }
    }
    return false;
}

function handleQueueCheckRequest(event) {
    var userId = event.source.userId;
    var replyToken = event.replyToken;
    var userMessageLower = event.message.text.trim().toLowerCase();
    var settings = getSettings();
    if (!settings) return;

    var bookingSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Booking');
    if (bookingSheet.getLastRow() < 2) {
        reply(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูลการจองคิวของคุณค่ะ' }], settings.botConnect);
        return;
    }

    var bookings = bookingSheet.getRange(2, 1, bookingSheet.getLastRow() - 1, 8).getValues();
    var userBooking = null;
    var today = new Date();
    today.setHours(0,0,0,0);

    for (var i = bookings.length - 1; i >= 0; i--) {
        var booking = bookings[i];
        var bookingDate = new Date(booking[5]);
        
        if (booking[1] === userId && booking[6] === 'Confirmed' && bookingDate >= today) {
            userBooking = {
                timestamp: booking[0], userId: booking[1], displayName: booking[2], phone: booking[3],
                service: booking[4], bookingDateTime: bookingDate, status: booking[6], queueNumber: booking[7]
            };
            break; 
        }
    }
    
    if (userBooking) {
        if (userMessageLower === 'ข้อมูลการจอง') {
            var bookingDataForReceipt = {
                phone: userBooking.phone,
                service: userBooking.service,
                date: userBooking.bookingDateTime.toLocaleDateString('en-GB'), // DD/MM/YYYY
                time: userBooking.bookingDateTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })
            };
            var receiptFlex = generateFinalBookingReceipt(bookingDataForReceipt, userBooking.queueNumber);
            reply(replyToken, [receiptFlex], settings.botConnect);
        } else {
            var queuesWaiting = 0;
            bookings.forEach(function(b) {
                var bDate = new Date(b[5]);
                if (b[6] === 'Confirmed' && bDate.toDateString() === userBooking.bookingDateTime.toDateString() && bDate < userBooking.bookingDateTime) {
                    queuesWaiting++;
                }
            });

            var waitMilliseconds = queuesWaiting * 15 * 60 * 1000;
            var waitHours = Math.floor(waitMilliseconds / 3600000);
            var waitMinutes = Math.floor((waitMilliseconds % 3600000) / 60000);
            var waitSeconds = Math.floor(((waitMilliseconds % 3600000) % 60000) / 1000);
            var waitTimeStr = ('0' + waitHours).slice(-2) + ':' + ('0' + waitMinutes).slice(-2) + ':' + ('0' + waitSeconds).slice(-2);
            
            var queueFlex = generateQueueFlex(userBooking, queuesWaiting, waitTimeStr);
            reply(replyToken, [queueFlex], settings.botConnect);
        }
    } else {
        reply(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูลการจองคิวของคุณค่ะ' }], settings.botConnect);
    }
}


function generateQueueFlex(userBooking, queuesWaiting, waitTimeStr) {
    return {
        type: 'flex',
        altText: 'ข้อมูลคิวของคุณ',
        contents: {
            "type": "bubble", "size": "mega",
            "body": {
                "type": "box", "layout": "vertical", "spacing": "md", "contents": [
                    { "type": "text", "text": "Service Queue", "weight": "bold", "size": "sm", "color": "#555555", "align": "center" },
                    { "type": "text", "text": "หมายเลขคิวของคุณ", "weight": "bold", "size": "lg", "color": "#00664F", "align": "center", "margin": "sm" },
                    { "type": "box", "layout": "vertical", "margin": "md", "borderColor": "#00664F", "borderWidth": "2px", "cornerRadius": "8px", "paddingAll": "12px", "contents": [ { "type": "text", "text": userBooking.queueNumber, "weight": "bold", "size": "3xl", "align": "center", "color": "#00664F" } ] },
                    { "type": "text", "text": "เวลารอเข้ารับบริการ (โดยประมาณ)", "size": "sm", "color": "#555555", "align": "center", "margin": "md" },
                    { "type": "text", "text": waitTimeStr, "weight": "bold", "size": "xl", "color": "#000000", "align": "center" },
                    { "type": "separator", "margin": "lg" },
                    { "type": "box", "layout": "horizontal", "spacing": "sm", "margin": "md", "contents": [
                            { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "จำนวนคิวรอ", "size": "xs", "color": "#666666", "align": "center" }, { "type": "text", "text": queuesWaiting.toString(), "size": "sm", "color": "#00664F", "align": "center", "weight": "bold" } ], "flex": 1 },
                            { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "สถานะ", "size": "xs", "color": "#666666", "align": "center" }, { "type": "text", "text": "รอเข้ารับบริการ", "size": "sm", "color": "#00664F", "align": "center", "weight": "bold" } ], "flex": 1 }
                        ]
                    }
                ], "paddingAll": "16px"
            }
        }
    };
}

/********************************************************************************
 * ระบบแจ้งซ่อม (Repair Request System)
 ********************************************************************************/
function startRepairFlow(event) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var settings = getSettings();
  if (!settings) return;
  var cache = CacheService.getScriptCache();

  // ล้างค่าเก่า (ถ้ามี) แล้วเริ่ม Flow ใหม่
  clearAllCache(userId);
  cache.put('user_flow_' + userId, 'repair', 900); // Lock flow for 15 mins
  cache.put('repair_state_' + userId, 'awaiting_asset_details', 900);
  cache.put('repair_data_' + userId, JSON.stringify({}), 900);

  var message = {
    type: 'text',
    text: 'สวัสดีค่ะ 📝 กรุณาแจ้งอุปกรณ์หรือสิ่งที่ต้องการแจ้งซ่อมได้เลยค่ะ\n(เช่น แอร์ห้องนอน, เครื่องซักผ้า, คอมพิวเตอร์)'
  };
  reply(replyToken, [message], settings.botConnect);
}

function handleRepairState(event, state) {
  var userId = event.source.userId;
  var replyToken = event.replyToken;
  var userMessage = event.message.text.trim();
  var settings = getSettings();
  if (!settings) return;
  var cache = CacheService.getScriptCache();
  var repairDataJson = cache.get('repair_data_' + userId);
  var repairData = repairDataJson ? JSON.parse(repairDataJson) : {};

  if (state === 'awaiting_asset_details') {
    repairData.asset = userMessage;
    cache.put('repair_data_' + userId, JSON.stringify(repairData), 900);
    cache.put('repair_state_' + userId, 'awaiting_problem_description', 900);
    var message = { type: 'text', text: 'รับทราบค่ะ ✅\n\nกรุณาอธิบายอาการเสีย หรือปัญหาที่พบโดยละเอียดค่ะ' };
    reply(replyToken, [message], settings.botConnect);

  } else if (state === 'awaiting_problem_description') {
    repairData.problem = userMessage;
    cache.put('repair_data_' + userId, JSON.stringify(repairData), 900);
    cache.put('repair_state_' + userId, 'awaiting_photo_or_skip', 900);
    var message = {
      type: 'text',
      text: 'หากมีรูปภาพประกอบ กรุณาส่งเข้ามาได้เลยค่ะ\nหากไม่มี สามารถกด "ข้าม" ได้เลยค่ะ',
      quickReply: {
        items: [{ type: 'action', action: { type: 'message', label: 'ข้าม', text: 'ข้าม' } }]
      }
    };
    reply(replyToken, [message], settings.botConnect);

  } else if (state === 'awaiting_photo_or_skip') {
    if (userMessage.toLowerCase() === 'ข้าม') {
      repairData.photoUrl = ''; // ไม่มีรูป
      cache.put('repair_data_' + userId, JSON.stringify(repairData), 900);
      cache.put('repair_state_' + userId, 'awaiting_confirmation', 900);
      var confirmationFlex = generateRepairConfirmationFlex(repairData);
      reply(replyToken, [confirmationFlex], settings.botConnect);
    } else {
      reply(replyToken, [{ type: 'text', text: 'กรุณาส่งเป็น "รูปภาพ" หรือกดปุ่ม "ข้าม" เท่านั้นค่ะ' }], settings.botConnect);
    }
  } else if (state === 'awaiting_confirmation') {
    if (userMessage.toLowerCase() === 'ยืนยันการแจ้งซ่อม') {
      var result = saveRepairRequest(userId, repairData);
      var receiptFlex = generateFinalRepairReceipt(repairData, result.repairId);
      reply(replyToken, [receiptFlex], settings.botConnect);
      
      // แจ้งเตือนแอดมิน
      var admins = getAdmins();
      if (admins.length > 0) {
        var userProfile = getProfile(userId);
        var adminFlex = generateAdminRepairNotificationFlex(repairData, result.repairId, userProfile);
        admins.forEach(function(adminId) { pushMessage(adminId, [adminFlex]); });
      }
      
      clearAllCache(userId);
    } else {
      reply(replyToken, [{ type: 'text', text: 'กรุณากดปุ่ม "ยืนยันการแจ้งซ่อม" หรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่ค่ะ' }], settings.botConnect);
    }
  }
}

function saveRepairRequest(userId, repairData) {
  var userProfile = getProfile(userId);
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Repairs');
  var timestamp = new Date();
  var repairId = 'RP' + timestamp.getTime().toString().slice(-8);

  sheet.appendRow([
    timestamp,
    repairId,
    userId,
    userProfile.displayName,
    repairData.asset,
    repairData.problem,
    repairData.photoUrl || '', // ถ้าไม่มีรูปให้เป็นค่าว่าง
    'แจ้งเรื่อง', // Status เริ่มต้น
    '' // Admin Notes ว่างไว้ก่อน
  ]);

  return { success: true, repairId: repairId };
}


function generateRepairConfirmationFlex(repairData) {
  var photoComponent = { "type": "text", "text": "ไม่มีรูปภาพประกอบ", "size": "sm", "color": "#AAAAAA", "wrap": true };
  if (repairData.photoUrl) {
    photoComponent = { "type": "image", "url": repairData.photoUrl, "size": "lg", "aspectMode": "cover" };
  }

  return {
    type: 'flex',
    altText: 'ตรวจสอบข้อมูลการแจ้งซ่อม',
    contents: {
      "type": "bubble", "size": "giga",
      "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "กรุณาตรวจสอบข้อมูล", "weight": "bold", "color": "#FFFFFF", "size": "lg" }], "backgroundColor": "#FF6F00", "paddingAll": "20px" },
      "body": {
        "type": "box", "layout": "vertical", "spacing": "md", "contents": [
          { "type": "text", "text": "รายการแจ้งซ่อม", "weight": "bold", "size": "md" },
          { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [{ "type": "text", "text": "อุปกรณ์:", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": repairData.asset, "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }] },
          { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [{ "type": "text", "text": "อาการ/ปัญหา:", "color": "#aaaaaa", "size": "sm" }, { "type": "text", "text": repairData.problem, "wrap": true, "color": "#666666", "size": "sm" }] },
          { "type": "separator", "margin": "lg" },
          { "type": "text", "text": "รูปภาพประกอบ", "weight": "bold", "size": "md", "margin": "md" },
          photoComponent
        ]
      },
      "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [{ "type": "button", "style": "primary", "color": "#FF6F00", "action": { "type": "message", "label": "ยืนยันการแจ้งซ่อม", "text": "ยืนยันการแจ้งซ่อม" } }, { "type": "button", "action": { "type": "message", "label": "ยกเลิก", "text": "ยกเลิก" } }] }
    }
  };
}

function generateFinalRepairReceipt(repairData, repairId) {
    return {
        type: 'flex', altText: 'แจ้งซ่อมสำเร็จ', contents: {
            "type": "bubble", "size": "mega",
            "body": { "type": "box", "layout": "vertical", "paddingAll": "24px", "spacing": "md", "backgroundColor": "#F0F4F8", "contents": [
                { "type": "image", "url": "https://kwanjaiservices.com/wp-content/uploads/2021/05/AW_Info_Web_KJ_SiteInspection.png", "size": "md", "aspectMode": "fit", "align": "center" },
                { "type": "text", "text": "รับเรื่องแจ้งซ่อมเรียบร้อย", "weight": "bold", "size": "xl", "align": "center", "margin": "md", "color": "#1A237E" },
                { "type": "text", "text": "เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด", "size": "sm", "align": "center", "color": "#546E7A" },
                { "type": "box", "layout": "vertical", "margin": "lg", "paddingAll": "16px", "cornerRadius": "8px", "backgroundColor": "#FFFFFF", "contents": [
                    { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [{ "type": "text", "text": "เลขที่ใบแจ้งซ่อม:", "flex": 2, "size": "sm", "color": "#90A4AE" }, { "type": "text", "text": repairId, "flex": 3, "size": "sm", "weight": "bold", "color": "#263238" }] },
                    { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [{ "type": "text", "text": "อุปกรณ์:", "flex": 2, "size": "sm", "color": "#90A4AE" }, { "type": "text", "text": repairData.asset, "flex": 3, "size": "sm", "wrap": true, "color": "#263238" }] }
                ]}
            ]}
        }
    };
}

function generateAdminRepairNotificationFlex(repairData, repairId, userProfile) {
    return {
        type: 'flex', altText: 'มีรายการแจ้งซ่อมใหม่', contents: {
            "type": "bubble", "size": "giga",
            "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "⚠️ มีรายการแจ้งซ่อมใหม่!", "weight": "bold", "color": "#FFFFFF", "size": "lg" }], "backgroundColor": "#D32F2F", "paddingAll": "20px" },
            "body": { "type": "box", "layout": "vertical", "spacing": "md", "paddingAll": "20px", "contents": [
                { "type": "box", "layout": "baseline", "contents": [{ "type": "text", "text": "เลขที่:", "flex": 1, "size": "sm", "color": "#AAAAAA" }, { "type": "text", "text": repairId, "flex": 3, "size": "sm", "weight": "bold" }] },
                { "type": "box", "layout": "baseline", "contents": [{ "type": "text", "text": "ผู้แจ้ง:", "flex": 1, "size": "sm", "color": "#AAAAAA" }, { "type": "text", "text": userProfile.displayName, "flex": 3, "size": "sm" }] },
                { "type": "box", "layout": "baseline", "contents": [{ "type": "text", "text": "อุปกรณ์:", "flex": 1, "size": "sm", "color": "#AAAAAA" }, { "type": "text", "text": repairData.asset, "flex": 3, "size": "sm", "wrap": true }] },
                { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": "อาการ:", "size": "sm", "color": "#AAAAAA" }, { "type": "text", "text": repairData.problem, "wrap": true, "size": "sm" }] }
            ]},
            "footer": repairData.photoUrl ? { "type": "box", "layout": "vertical", "contents": [{ "type": "button", "action": { "type": "uri", "label": "ดูรูปภาพประกอบ", "uri": repairData.photoUrl }, "style": "primary", "color": "#1976D2" }] } : null
        }
    };
}
