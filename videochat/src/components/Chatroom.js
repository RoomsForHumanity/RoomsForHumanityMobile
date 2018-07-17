import React, { Component } from 'react';
import { View } from 'react-native';
import { CardSection, Card, Input, Button } from './common';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';
import io from 'socket.io-client';


class Chatroom extends Component {
  state = { localStreams: {},
            localStream: undefined,
            peers: [],
            peerNumberOf: { userID: 'peerNumber' },
            statsIteration: 1,
            streamEng: { socket: null,
                        serviceAddress: null,
                        onSubscribeDone: undefined,
                      },
            numPublishers: 0,
            startStream: false,
            roomName: ''
          };

  createPeerConnection() {
    const { clientID, newPeerConnection, socket, roomNameInput } = this.state;
    const configOptions = { iceServers: [
              { url: 'stun:stun.l.google.com:19302' },
              { url: 'turn:numb.viagenie.ca',
                credential: 'enter1234',
                username: 'bethin.charles@yahoo.com'
              }
              ]
            };
    const pc = new RTCPeerConnection(socket);
    console.log('Created peer connection')
    this.setState({ newPeerConnection: pc });

    pc.onicecandidate = (event) => {
      console.log('onicecandidate');
      if (event.candidate != null) {
        socket.emit('signal',
                { type: 'ice', ice: event.candidate, userID: this.state.userID },
                this.state.peerUserID,
                this.state.roomNameInput);
      }
    };

    if (this.state.publisherNumber !== null) {
      pc.onaddstream = (event) => {
        console.log('Received remote stream: ', event.stream);
      };
    }
    console.log('Returning peer connection');
    return pc;
  }

  joinRoom() {
    console.log('joinRoom');
    try {
      this.setupMediaStream()
    } catch (err) {
      console.log('error', err);
    }
  }

  setupMediaStream() {
    const { videoURL, stream1, isFront, startStream, peerNumber } = this.state;
    getUserMedia(
      {
      audio: true,
      video: {
        mandatory: {},
        facingMode: isFront ? 'user' : 'environment',
      }
    },
    (stream) => {
      console.log('Setting up stream');
      this.setState({ videoURL: stream.toURL() });
      this.setState({ stream1: stream });
      this.shareStream();  // stream1, startStream, peerNumber
    },
      err => console.error(err)
    );
  }

  subscribe() {
    const { serviceAddress, socket, roomName, roomExists, passcode } = this.state;
    console.log('subscribe');

    this.setState({ socket: io.connect(this.state.serviceAddress) });

    console.log('Connected to Stream Server');
    console.log(this.state.serviceAddress);
    console.log(this.state.roomName);

    this.state.socket.emit('subscribe rooms', this.state.roomName);
    this.state.socket.on('subscribe response', (roomExists, passcode) => {
      this.setState({ roomExists, passcode });
      if (!this.state.roomExists) {
        // Ask for pin to protect room
      } else {
        //save the pin
      }
    });
  }

  shareStream() {
    const { localStream, startStream, peerNumber } = this.state;
    console.log('shareStream');
    const { stream, socket } = this.state;
    socket.on('connect', (data) => {
      console.log('connect');
      this.setupMediaStream();
    });
    console.log('onPublish')
  }

  publish() {
    const { startStream, socket } = this.state;
    this.setState({ startStream: false });
    this.setupMediaStream();
    socket.emit('publish rooms', this.state.roomName);
    socket.on('publish response', (roomExists, passcode) => {
      if (!roomExists) {
        //Enter pin to protect room
      }
      else {
        // pin = passcode
      }
    });
  }

  setUpService() {
    this.subscribe();
  }

  render() {

  }

}

export default Chatroom;
