let video_source_selector = document.querySelector('select');
let canvas = document.getElementById('mycanvas');
let context = canvas.getContext('2d');

document.getElementById('startbutton').addEventListener('click', function(ev){
    takepicture();
    ev.preventDefault();
    }, false);

navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device) => {
            if (device.kind == 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.deviceId;
                video_source_selector.add(device_option)
}});});

navigator.mediaDevices.getUserMedia({video:true}).then(
    (stream)=> {
        window.stream = stream;
        document.querySelector('video').srcObject=stream
    },
    (error)=>console.log('got media error:', error)
);

document.addEventListener('DOMContentLoaded',() => video_source_selector.onchange=changeVideoSource,false);

function changeVideoSource(event) {
    if (window.stream) {
        window.stream.getTracks().forEach(function(track) {track.stop();});
    }
    navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: event.target.value}}}).then(
        (stream)=> {
            window.stream = stream;
            document.querySelector('video').srcObject=stream
        },
        (error)=>console.log('got media error:', error)
    );
}

function takepicture() {
    let ws = new WebSocket("ws://localhost:8765");
    let width = window.stream.getVideoTracks()[0].getSettings().width;
    let height = window.stream.getVideoTracks()[0].getSettings().height;
    canvas.width = width;
    canvas.height = height;
    ws.onopen = () => {
        context.drawImage(document.querySelector('video'), 0, 0, width, height);
        //let data = canvas.toDataURL('image/png');
        canvas.toBlob((blob) => ws.send(blob))
    };
    ws.onmessage = (msg) => {
        //window.msg = msg
        console.log(msg);
        let imageUrl = URL.createObjectURL(msg.data);
        //document.querySelector("#image").src = imageUrl;
        //document.getElementById('photo').setAttribute('src', imageUrl);
        let img = new Image();
        img.onload = () => context.drawImage(img, 0, 0, width, height);
        img.src = imageUrl;
    }
}