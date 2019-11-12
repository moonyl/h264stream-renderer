import React, { useEffect, useRef } from "react";
import "./App.css";
import { w3cwebsocket as W3CWebSocket } from "websocket";
import { Player } from "broadway-player";

class WsRawH264Player {
  constructor({ useWorker, workerFile } = {}) {
    this.H264Player = new Player({
      useWorker,
      workerFile,
      size: {
        width: 640,
        height: 368
      }
    });
    this.width = 1280;
    this.height = 1024;
    this.H264Player.onPictureDecoded = (_, w, h) => {
      if (w !== this.width || h !== this.height) {
        //this.emit("resized", { width: w, height: h });
        console.log("resized: ", { width: w, height: h });
        this.width = w;
        this.height = h;
      }
      console.log("onPictureDecoded");
    };
    this.frameList = [];
    this.running = false;
  }

  shiftFrame = () => {
    if (!this.running) {
      console.log("not running");
      return;
    }

    if (this.frameList.length > 300) {
      //if (this.framesList.length > 30 * 1000) {
      //log("Dropping frames", this.framesList.length);
      console.log("Dropping frames", this.frameList.length);
      // PPS SPS IDR 이 한꺼번에 들어온다.
      const vI = this.frameList.findIndex(e => (e.frame[4] & 0x1f) === 7);
      // console.log('Dropping frames', framesList.length, vI)
      if (vI >= 0) {
        this.frameList = this.frameList.slice(vI);
      }
      // framesList = []
    }

    //let type;

    const elem = this.frameList.shift();
    //console.log("elem:", { elem });
    //console.log(this.frameList.length);
    //console.log({ frame });
    //type = frame[4] & 0x1f;
    //console.log("type: ", type);
    //this.emit("frame_shift", this.frameList.length);

    //if (frame) this.H264Player.decode(frame);
    if (elem) {
      const { frame, show } = elem;
      if (frame) {
        //const type = frame[4] & 0x1f;
        //if (type === 7 || type === 8) {
        this.H264Player.decode(frame);
        //}
      }
      if (show) {
        requestAnimationFrame(this.shiftFrame);
        return;
      }
    }

    //requestAnimationFrame(this.shiftFrame);
    setTimeout(this.shiftFrame, 1);
    // TODO : 여기에서 그릴지 말지를 결정해야 하지 않을까?
  };

  pushAvPacket = packet => {
    //console.log({ packet });
    // header, show, size 를 분리해야 한다.
    packet.arrayBuffer().then(buffer => {
      const headerStr = new TextDecoder("utf-8").decode(new Uint8Array(buffer, 0, 3));
      if (headerStr === "psd") {
        const show = new Uint8Array(buffer, 3, 1); // 1 or 0
        //const size = new Uint32Array(buffer, 4, 1); // size
        //console.log({ headerStr, show, size });
        const frame = new Uint8Array(buffer, 8);
        //console.log({ frame });
        //console.log({ frame });
        this.frameList.push({ frame, show });
      }
      //console.log([frame[0], frame[1], frame[2], frame[3], frame[4]]);
    });

    if (!this.running) {
      this.running = true;
      clearTimeout(this.shiftFrameTimeout);
      this.shiftFrameTimeout = null;
      this.shiftFrameTimeout = setTimeout(this.shiftFrame, 1);
      //this.shiftFrameTimeout = setTimeout(this.shiftFrame, 40);
    }
  };
}

function App() {
  const videoBox = useRef(null);

  useEffect(() => {
    console.log("렌더링이 완료되었습니다!");
    const { hostname, protocol } = window.location;
    console.log({ protocol });
    const wsProtocol = protocol === "http:" ? "ws" : "wss";
    const id = "56f3284c-a6e8-4d92-8a17-30596c5205ce";
    var player = new WsRawH264Player({ useWorker: true });
    const client = new W3CWebSocket(`${wsProtocol}://${hostname}:5000/h264Stream/${id}`);
    client.onopen = () => {
      console.log("connected OK");
    };
    client.onmessage = evt => {
      //console.log("should handle message");
      //console.log({ evt });
      player.pushAvPacket(evt.data);
    };
    client.onerror = error => {
      console.log({ error });
    };
    videoBox.current.appendChild(player.H264Player.canvas);
  }, []);

  return (
    <>
      <p>Hello World</p>
      <div ref={videoBox}></div>
    </>
  );
}

export default App;
