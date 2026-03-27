const http = require('http');

const API_URL = 'http://localhost:3001/api';

async function main() {
  // Lấy params từ dòng lệnh, nếu không có thì dùng mặc định
  const email = process.argv[2] || 'dat723278@gmail.com';
  const password = process.argv[3] || 'Aa@123456'; 
  const message = process.argv[4] || 'Kiểm tra trạng thái đơn cứu hộ của tôi nhé';

  console.log(`1. Đăng nhập với email: ${email} ...`);
  const loginRes = await fetch(`${API_URL}/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error('=> Đăng nhập thất bại. Lỗi:', err);
    console.log('\nCách sử dụng: node test-chatbot.js <email> <password> "<câu_hỏi>"');
    console.log('Ví dụ: node test-chatbot.js user@gmail.com 123456 "Tôi muốn xem các đơn của tôi"');
    return;
  }

  const { accessToken } = await loginRes.json();
  console.log('=> Đăng nhập thành công!\n');
  
  console.log('2. Khởi tạo phiên trò chuyện mới...');
  const convRes = await fetch(`${API_URL}/chatbot/conversations`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ title: 'Test chatbot API' })
  });
  
  const { id: convId } = await convRes.json();
  console.log(`=> Đã tạo hội thoại: ${convId}\n`);

  console.log(`3. Bắt đầu gửi tin nhắn: "${message}"`);
  console.log('Đang chờ AI trả lời (chế độ gõ từng chữ)...\n-------------------------------------------------\n');

  // Dùng http.request để parse Server-Sent Events (SSE) theo chuẩn chunk stream
  const req = http.request(`${API_URL}/chatbot/conversations/${convId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      // Chunk có dạng: data: {"type":"delta","content":"Chào bạn"} \n\n
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          
          if (dataStr === '[DONE]') {
            console.log('\n\n-------------------------------------------------');
            console.log('=> HOÀN TẤT LUỒNG TRẢ LỜI CỦA AI!');
            return;
          }
          if (!dataStr) continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'delta' && data.content) {
              process.stdout.write(data.content); // In ra màn hình từng chữ (streaming)
            } else if (data.type === 'tool_start') {
              console.log(`\n\n[⚙️ AI đang gọi API hệ thống: ${data.toolName}...]`);
            } else if (data.type === 'tool_end') {
              console.log(`[✅ AI đã lấy được dữ liệu từ ${data.toolName}]\n`);
            } else if (data.type === 'error') {
              console.log(`\n[❌ LỖI API]: ${data.content}\n`);
            }
          } catch(e) {
            // bỏ qua lỗi parse json nếu nửa chừng
          }
        }
      }
    });
  });

  req.on('error', (e) => {
    console.error(`\nLỗi gọi API chatbot: ${e.message}`);
  });

  // Gửi nội dung tin nhắn đi
  req.write(JSON.stringify({ content: message }));
  req.end();
}

main().catch(console.error);
