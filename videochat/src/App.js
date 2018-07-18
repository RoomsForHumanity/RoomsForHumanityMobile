import React, { Component } from 'react';
import firebase from 'firebase';
import io from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';
import { Header, CardSection, Button, Card } from './components/common';
import SignInForm from './components/SignInForm';

// const socket = io.connect('https://stream.roomsforhumanity.org', { transports: ['websocket'] });
// const configOptions = { iceServers: [
//                           { url: 'stun:stun.l.google.com:19302' },
//                           { url: 'turn:turn:numb.viagenie.ca',
//                             credential: 'enter1234',
//                             username: 'bethin.charles@yahoo.com' }
//                         ] };

class App extends Component {
  state = { stream: 'https://stream.roomsforhumanity.org',
          videoURL: '',
          isFront: true };

  componentWillMount() {

    }

    componentDidMount() {
    }

    getLocalStream() {
      getUserMedia({
        audio: true,
        video: {
          mandatory: {},
          facingMode: this.state.isFront ? 'user' : 'environment',
        }
      },
      stream => {
        this.setState({ videoURL: stream.toURL() });
      },
        err => console.error(err)
      );
    }

  render() {
    return (
      <Card>

        <Header headerText='Rooms for Humanity' />

        <SignInForm />

      </Card>
    );
  }
}


export default App;
