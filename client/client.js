let video_source_selector = document.querySelector('select');

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
    let canvas = document.getElementById('mycanvas');
    let context = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 500;
    context.drawImage(document.querySelector('video'), 0, 0, 500, 500);
    let data = canvas.toDataURL('image/png');
    document.getElementById('photo').setAttribute('src', data);
}

function send_pic() {

}