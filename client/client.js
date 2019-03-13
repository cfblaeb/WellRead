// dom element shortcuts
let video_el = document.getElementById('video_id');
let canvas_el = document.getElementById('canvas_id');
let video_source_selector = document.getElementById('video_source_select');

let back_button = document.getElementById('back_btn');
let fwd_button = document.getElementById('fwd_btn');

let result_table = document.getElementById('result_table');

let program_state = 0;
/*
    0: Taking a picture of the plate
        camera          on
        canvas          show live camera
        fwd button text take picture
        button action   stop camera
    1: Align well grid
        camera          off
        canvas          show photo and overlay interactive grid
        fwd button text analyze barcodes
        button action   send image and grid to server
    2: Results
        camera          off
        canvas          show photo and color coded grid
        fwd_button text restart
        button action   goto status 0
*/
//canvas/video size
let width = 1920;
let height = 1080;
//video_el.width = width;
//video_el.height = height;
//canvas_el.width = width;
//canvas_el.height = height;

// activate copy/paste button
let clipboard = new ClipboardJS('.btn');
clipboard.on('success', function(e) {
    e.clearSelection();
});

// let fabric control the canvas
let canvas = new fabric.Canvas('canvas_id', {
    selection: false,
});
canvas.on('object:selected', function(o){
    let activeObj = o.target;
    if (activeObj.get('type') == 'group') {
        activeObj.set({'borderColor':'#ff0000','cornerColor':'#fbb802'});
    }
});
// craete fabric webcam image
let webcam = new fabric.Image(video_el, {
    left: 0,
    top: 0,
    objectCaching: false,
    selectable: false
});

//grid
function draw_grid() {
    // plate dimensions
    let no_rows = 8;
    let no_columns = 12;
    if (width>height) {
        square_size = width/12;
        no_rows = 8;
        no_columns = 12;
    } else {
        square_size = height/12;
        no_rows = 12;
        no_columns = 8;
    }

    let lines = [];
    for (let row = 1; row<no_rows; row++ ) {
        lines.push(new fabric.Line([ 0, row*square_size, no_columns*square_size, row*square_size], {stroke: '#FF0000'}))
    }
    for (let column = 1; column<no_columns; column++ ) {
        lines.push(new fabric.Line([ column*square_size, 0, column*square_size, no_rows*square_size], {stroke: '#FF0000'}))
    }
    let pl = new fabric.Group(lines);
    canvas.add(pl);
}

function render() {
    if (program_state===0) {
        canvas.renderAll();
        fabric.util.requestAnimFrame(render);
    }
}

function set_video_and_stuff(stream) {
    width = stream.getVideoTracks()[0].getSettings().width;
    height = stream.getVideoTracks()[0].getSettings().height;
    //canvas_el.width = width;
    //canvas_el.height = height;
    //video_el.width = width;
    //video_el.height = height;
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.calcOffset();
    window.stream = stream;
    video_el.srcObject=stream;
    canvas.add(webcam);
    webcam.moveTo(0);
    webcam.getElement().play();
    fabric.util.requestAnimFrame(
        render
    );
}

// list cameras
navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device) => {
            if (device.kind === 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.deviceId;
                video_source_selector.add(device_option)
}});});

// change camera
function changeVideoSource(event) {
    if (program_state === 0) {
        if (window.stream) {window.stream.getTracks().forEach(function(track) {track.stop();});}
        navigator.mediaDevices.getUserMedia({video:{deviceId: {exact: event.target.value}}}).then(
            (stream)=> {set_video_and_stuff(stream);},(error)=>console.log('got media error:', error)
        );
    }
}

function send_picture_and_wait_for_response() {
    let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    //let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => {
        canvas_el.toBlob((blob) => ws.send(blob));
    };
    ws.onmessage = (msg) => {
        if (typeof(msg.data)=="string") {
            let results = JSON.parse(msg.data);
            results.forEach((result) => {
                let new_row = result_table.insertRow(-1);
                let row_cell = new_row.insertCell(0);
                let col_cell = new_row.insertCell(1);
                let barcode_cell = new_row.insertCell(2);
                let row_text = document.createTextNode(result.row);
                let col_text = document.createTextNode(result.col);
                let barcode_text = document.createTextNode(result.barcode);
                row_cell.appendChild(row_text);
                col_cell.appendChild(col_text);
                barcode_cell.appendChild(barcode_text);
            });
        } else {
            let imageUrl = URL.createObjectURL(msg.data);
            let img = new Image();
            img.onload = () => {
                canvas.clear();
                let faim = new fabric.Image(img);
                canvas.add(faim);
            };
            img.src = imageUrl;
        }
    }
}

//event listeners
document.addEventListener('DOMContentLoaded',() => video_source_selector.onchange=changeVideoSource,false);

function do_state_change(direction) {
    if (direction === -1) {
        if (program_state>0) {
            program_state--; // go back
        }
    } else if (direction === 1) {
        if (program_state<2) {
            program_state++; // go forward
        } else {
            program_state = 0; // reset
        }
    }
    switch (program_state) {
        case 0:
            // activate camera
            navigator.mediaDevices.getUserMedia({video:true}).then(
                (stream)=> { set_video_and_stuff(stream); },
                (error)=>console.log('got media error:', error)
            );
            // set button text
            back_button.innerText = "< (1/3)";
            fwd_button.innerText = "Take photo (2/3)>";
            break;
        case 1:
            //take photo
            let a3 = "";
            webcam.cloneAsImage(function(cloned) {
                a3 = cloned;
            });
            //stop camera
            window.stream.getTracks().forEach((track) => track.stop());
            a3.set('selectable', false);
            canvas.add(a3);
            //draw grid
            draw_grid();
            // set button text
            back_button.innerText = "< (1/3) Take another photo";
            fwd_button.innerText = "Analyze barcodes (3/3) >";
            break;
        case 2:
            // send data
            send_picture_and_wait_for_response();
            // receive data
            // handle data
            // set button text
            back_button.innerText = "< (2/3) Change grid";
            fwd_button.innerText = "Back to start (1/3) >";
            break;
    }
}

back_button.addEventListener('click', () => do_state_change(-1));
fwd_button.addEventListener('click', () => do_state_change(1));
do_state_change(0);