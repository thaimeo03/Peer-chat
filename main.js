// Mã xác định ứng dụng của Agora RTM
let APP_ID = "f9c62b47fe0345d39a18e5f4cd0558b3"

// Token và uid để xác thực người dùng
let token = null
let uid = String(Math.floor(Math.random() * 10000))

// Querystring
let querystring = window.location.search
let urlParams = new URLSearchParams(querystring)
let roomId = urlParams.get('room')

if(!roomId) {
  window.location = `lobby.html`
}

// Các biến toàn cục
let client
let channel
let localStream
let remoteStream
let peerConnection

// Cấu hình máy chủ ICE (Interactive Connectivity Establishment)
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ]
}

// Hàm khởi tạo
let init = async () => {
  // Khởi tạo Agora RTM client và đăng nhập
  client = await AgoraRTM.createInstance(APP_ID)
  await client.login({ uid, token })

  // Tạo và tham gia kênh giao tiếp
  channel = client.createChannel(roomId)
  await channel.join()

  // Gán sự kiện khi có thành viên mới tham gia
  channel.on('MemberJoined', handleUserJoined)
  // Gán sự kiện khi rời
  channel.on('MemberLeft', handleUserLeft)

  // Gán sự kiện khi nhận tin nhắn từ đối tác
  client.on('MessageFromPeer', handleMessageFromPeer)

  // Lấy dữ liệu video từ camera và hiển thị nó
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  })

  document.getElementById('user-1').srcObject = localStream
}

// Xử lý sự kiện khi rời
let handleUserLeft = async (MemberId) => {
  document.getElementById('user-2').style.display = 'none'
}

// Xử lý sự kiện khi có thành viên mới tham gia
let handleUserJoined = async (MemberId) => {
  console.log('User joined: ', MemberId)
  createOffer(MemberId)
}

// Xử lý tin nhắn từ đối tác
let handleMessageFromPeer = async (message, MemberId) => {
  // Giải mã tin nhắn JSON
  message = JSON.parse(message.text)

  // Xử lý tin nhắn kiểu 'offer'
  if (message.type === 'offer') {
    createAnswer(MemberId, message.offer)
  }

  // Xử lý tin nhắn kiểu 'answer'
  if (message.type === 'answer') {
    addAnswer(message.answer)
  }

  // Xử lý tin nhắn kiểu 'candidate'
  if (message.type === 'candidate') {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate)
    }
  }
}

// Tạo đối tượng RTCPeerConnection và cấu hình nó
let createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers)

  // Tạo đối tượng MediaStream để lưu trữ dữ liệu video từ đối tác
  remoteStream = new MediaStream()
  document.getElementById('user-2').srcObject = remoteStream
  document.getElementById('user-2').style.display = 'block'

  // Nếu chưa có dữ liệu video từ người dùng hiện tại, lấy nó
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })
    document.getElementById('user-1').srcObject = localStream
  }

  // Thêm các track từ localStream vào peerConnection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  // Sự kiện khi nhận được dữ liệu video từ đối tác
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track)
    })
  }

  // Sự kiện khi tìm thấy candidate ICE
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      // Gửi candidate đến đối tác qua Agora RTM
      client.sendMessageToPeer({ text: JSON.stringify({
        'type': 'candidate',
        'candidate': event.candidate
      }) }, MemberId)
    }
  }
}

// Tạo và gửi offer đến đối tác
let createOffer = async (MemberId) => {
  await createPeerConnection(MemberId)

  // Tạo offer từ peerConnection
  let offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)

  // Gửi offer đến đối tác qua Agora RTM
  client.sendMessageToPeer({ text: JSON.stringify({
    'type': 'offer',
    'offer': offer
  }) }, MemberId)
}

// Tạo và gửi answer đến đối tác sau khi nhận được offer
let createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId)

  // Thiết lập remoteDescription từ offer
  await peerConnection.setRemoteDescription(offer)

  // Tạo answer từ peerConnection và gửi nó đến đối tác
  let answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)

  // Gửi answer qua Agora RTM
  client.sendMessageToPeer({ text: JSON.stringify({
    'type': 'answer',
    'answer': answer
  }) }, MemberId)
}

// Thêm answer vào kết nối
let addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    // Thiết lập remoteDescription nếu chưa có
    await peerConnection.setRemoteDescription(answer)
  }
}

// Rời kênh
let leaveChannel = async () => {
  await channel.leave()
  await client.logout()
}

// Lắng nghe sự kiện rời kênh
window.addEventListener('beforeunload', leaveChannel)

// Gọi hàm khởi tạo
init()
