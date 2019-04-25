// dom element shortcuts
let video_el = document.getElementById('video_id');
let canvas_el = document.getElementById('canvas_id');
let fullres_canvas = document.getElementById("fullres_canvas_id");
let video_source_selector = document.getElementById('video_source_select');
let back_button = document.getElementById('back_btn');
let fwd_button = document.getElementById('fwd_btn');
let result_table = document.getElementById('result_table');

let program_state = 0;
/*
    0: Taking a picture of the plate
        camera          on, hidden
        canvas          show camera
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

function setCookie(name,value,days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

// activate copy/paste button
let clipboard = new ClipboardJS('.btn');
clipboard.on('success', function(e) {
    e.clearSelection();
});

function draw_grid () {
    // plate dimensions
    let no_rows = 0;
    let no_columns = 0;

    if (canvas.width>canvas.height) { // landscape
        no_rows = 8;
        no_columns = 12;
    } else { // portrait
        no_rows = 12;
        no_columns = 8;
    }
    let square_size = Math.min(canvas.height/no_rows, canvas.width/no_columns)*0.8;

    let lines = [];
    for (let row = 1; row<no_rows; row++ ) {
        lines.push(new fabric.Line([ square_size, row*square_size+square_size, no_columns*square_size+square_size, row*square_size+square_size], {stroke: '#FF0000'}))
    }
    for (let column = 1; column<no_columns; column++ ) {
        lines.push(new fabric.Line([ column*square_size+square_size, square_size, column*square_size+square_size, no_rows*square_size+square_size], {stroke: '#FF0000'}))
    }
    window.pl = new fabric.Group(lines);
    window.canvas.add(window.pl);
}

// function to update the canvas
function render() {
    if (program_state===0) {
        canvas.renderAll();
        fabric.util.requestAnimFrame(render);
    }
}

function start_camera() {
    if (program_state===0) {
        if (video_el.srcObject) {video_el.srcObject.getTracks().forEach(function(track) {track.stop();});}
        let deid = video_source_selector.value;
        navigator.mediaDevices.getUserMedia({
        video: {
            width: 1920,//camera_list[deid].width.max,
            //height: 1080*2,//camera_list[deid].height.max,
            deviceId: {exact: deid}
        },
        }).then(
            (stream)=> {
                video_el.onplay = () => {
                    // add widht+height tag to video el. Needed for fabricjs
                    //alert(video_el.videoWidth + " "+ video_el.videoHeight);
                    video_el.width = video_el.videoWidth;
                    video_el.height = video_el.videoHeight;
                    // if a canvas object already exist, delete it
                    if (window.canvas) {
                        window.canvas.dispose();
                    }
                    // size the canvas
                    window.browser_width = document.documentElement.clientWidth - 200; // extra to get some space
                    let webcam_width = video_el.videoWidth;
                    if (window.browser_width>webcam_width) {
                        window.browser_width = webcam_width;
                    }
                    let scale = webcam_width/window.browser_width;

                    canvas_el.width = window.browser_width;
                    canvas_el.height = video_el.videoHeight/scale;
                    // let fabric control the canvas
                    window.canvas = new fabric.Canvas('canvas_id', {selection: false,});
                    window.canvas.on('object:selected', function(o){
                        let activeObj = o.target;
                        if (activeObj.get('type') === 'group') {
                            activeObj.set({'borderColor':'#ff0000','cornerColor':'#fbb802'});
                        }
                    });
                    window.canvas.on('mouse:down', state_forward);

                    window.webcam = new fabric.Image(video_el, {selectable: false});
                    window.webcam.scaleToWidth(window.browser_width);
                    window.canvas.add(window.webcam);
                    fabric.util.requestAnimFrame(render);
                };

                video_el.srcObject=stream;
                },
            (error)=>console.log('got media error:', error)
        );
    }
}

function send_picture_and_wait_for_response(image) {
    let ws = new WebSocket("wss://wellread.ebdrup.biosustain.dtu.dk/ws");
    //let ws = new WebSocket("ws://localhost:8765");
    ws.onopen = () => {
        ws.send(JSON.stringify({'grid': window.pl, 'scale': window.browser_width, 'images': window.ani}));
    };
    ws.onmessage = (msg) => {
        if (typeof(msg.data)=="string") {
            let results = JSON.parse(msg.data);
            // check if there are old results
            if (window.ress.length === 0) {
                // there are no previous results
                window.ress = results;
            } else {
                // there ARE previous results. Lets merge them with window.ress
                results.forEach((result) => {
                    // does this result have a barcode
                    if ((result.barcode !== 'failed') && (!result.barcode.startsWith("uncertain"))) {
                        // yes it has a barcode
                        let does_it_exists = window.ress.findIndex((existing) => existing['loc'] == result['loc']);
                        if (does_it_exists !== -1) {
                            // yes it exists and it has a barcode
                            // did the previous result have a barcode?
                            if ((window.ress[does_it_exists].barcode !== 'failed') && (!window.ress[does_it_exists].barcode.startsWith("uncertain"))) {
                                // yes the previous result has a barcode
                                // is it the same barcode?
                                if (window.ress[does_it_exists].barcode !== result.barcode) {
                                    // no they different!!
                                    // hmmm...lets just report it for now
                                    console.log("different good looking barcodes! " + result['loc'] + " : " + result.barcode + ", old:" + window.ress[does_it_exists]['loc'] + " : " + window.ress[does_it_exists].barcode)
                                }
                                // if they were the same, just ignore
                            } else {
                                // no previous barcode, so just overwrite
                                window.ress[does_it_exists] = result; // overwrite with new result
                            }
                        }

                    }
                })
            }
            // destroy any existing table
            document.getElementById('result_table').innerHTML = '';
            window.ress.forEach((result) => {
                let new_row = result_table.insertRow(-1);
                let loc_cell = new_row.insertCell(0);
                let barcode_cell = new_row.insertCell(1);
                let loc_text = document.createTextNode(result['loc']);
                let barcode_text = document.createTextNode(result.barcode);
                loc_cell.appendChild(loc_text);
                barcode_cell.appendChild(barcode_text);
            });
        } else {
            let imageUrl = URL.createObjectURL(msg.data);
            let img = new Image();
            img.onload = () => {
                window.canvas.clear();
                let timp = new fabric.Image(img);
                timp.scaleToWidth(window.browser_width);
                window.canvas.add(timp);
            };

            img.src = imageUrl;
        }
    }
}

function take_many_photos(how_many, delay, source, destination_el, destination_ctx, storage) {
    if (how_many===0) {
        return new Promise((resolve, reject) => resolve())
    } else {
		let p1 = new Promise((resolve, reject) => {
			setTimeout(() => {
			    let text40 = new fabric.Text("click" , {fontSize: 40, fill:'red', stroke:'green', left: 20, top: 10+(40*how_many) });
			    window.canvas.add(text40);
			    destination_ctx.drawImage(source, 0, 0);
			    fabric.Image.fromURL(fullres_canvas.toDataURL(), (e) => {
                        e.set('selectable', false);
                        e.scaleToWidth(window.browser_width);
                        window.ani.push(e);
                        take_many_photos(how_many-1, delay, source, destination_el, destination_ctx, storage).then(resolve);
                    });
                //destination_el.toBlob((blob) => {
                //    storage.push(blob);
                //    console.log("screenshot saved ", how_many);

                //}); // store a full_res blob for server
            }, delay)
        });
		return p1.then(() => {return new Promise((resolve, reject) => resolve())});
    }
}

function start_ani(current) {
    let prev = current - 1;
    if (prev < 0) prev = window.ani.length -1;
    window.canvas.remove(window.ani[prev]);
    window.canvas.add(window.ani[current]);
    window.canvas.moveTo(window.ani[current], 0);
    let next = current + 1;
    if (next >= window.ani.length) next = 0;
    if (program_state === 1) setTimeout(start_ani, 200, next);
}

function state_forward() {
    do_state_change(1);
}

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
            if (direction !== 0) { // we came from either 1 or 2
                window.canvas.clear();
            }

            start_camera(); // activate camera
            // set button text
            video_source_selector.disabled = false;
            back_button.innerText = "<";
            back_button.disabled = true;
            fwd_button.innerText = "Take photo >";
            break;
        case 1:
            // set buttons to "loading"
            window.canvas.off('mouse:down', state_forward);
            video_source_selector.disabled = true;
            back_button.disabled = true;
            fwd_button.disabled = true;
            back_button.innerHTML = '<span class="spinner-grow" role="status" aria-hidden="true"></span>Loading...';
            fwd_button.innerHTML = '<span class="spinner-border" role="status" aria-hidden="true"></span>Loading...';

            //create full res canvas copy of video
            if (direction === 1) { // if we came from state 0 then save a new full res video screenshot
                // take 10 images over a period of 1 sec
                fullres_canvas.width = video_el.videoWidth;
                fullres_canvas.height = video_el.videoHeight;
                window.full_res_blob = [];
                window.ani = [];
                let text40 = new fabric.Text("taking 5 pictures. Hold still!" , {fontSize: 40, left: 10, top: 10, fill:'red', stroke:'white'});
			    window.canvas.add(text40);
                take_many_photos(5, 1, video_el, fullres_canvas, fullres_canvas.getContext('2d'), window.full_res_blob).then(() => {
                    //stop camera
                    video_el.srcObject.getTracks().forEach((track) => track.stop());
                    window.canvas.clear();
                    start_ani(0);
                    draw_grid();
                    back_button.disabled = false;
                    fwd_button.disabled = false;
                    back_button.innerHTML = "< Retake photo";
                    fwd_button.innerHTML = "Analyze barcodes >";
                });
            } else {
                window.canvas.clear();
                start_ani(0);
                draw_grid();
                back_button.disabled = false;
                fwd_button.disabled = false;
                back_button.innerHTML = "< Retake photo";
                fwd_button.innerHTML = "Analyze barcodes >";
            }
            break;
        case 2:
            // send+receive data
            send_picture_and_wait_for_response();
            // set button text
            back_button.innerText = "< Change grid";
            fwd_button.innerText = "Re-take picture and update current results >";
            break;
    }
}

back_button.addEventListener('click', () => do_state_change(-1));
fwd_button.addEventListener('click', () => do_state_change(1));

navigator.mediaDevices.enumerateDevices().then(
    (devices) => {
        devices.forEach((device, i) => {
            if (device.kind === 'videoinput') {
                let device_option = document.createElement("option");
                device_option.value = device.deviceId;
                device_option.text = device.label || "camera " + i;
                video_source_selector.add(device_option);
            }
        });

        let val = getCookie("camera_choice");
        if (val) video_source_selector.value = val;

        video_source_selector.onchange = (e) => {
            setCookie("camera_choice", e.target.value, 10);
            start_camera();
        };

        do_state_change(0); // start the whole thing
    });

window.ress = []; // clear previous results on reload