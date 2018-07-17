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

        <CardSection>
          <Button onPress={this.getLocalStream.bind(this)}>
            Get video
          </Button>
        </CardSection>

        <CardSection>
          <RTCView style={styles.rtc} streamURL={this.state.videoURL} />
        </CardSection>

      </Card>
    );
  }
}

const styles = {
  rtc: {
    height: 640,
    width: 320,
    flex: 1,
    backgroundColor: '#000'
  }
};

export default App;
