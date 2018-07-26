'use strict';

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  TextInput,
  ListView,
  Platform,
} from 'react-native';

import io from 'socket.io-client';

import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';

const socket = io.connect('https://devstream.blinkcdn.com');


const configuration = { iceServers: [
                          { url: 'stun:stun.l.google.com:19302' },
                          { url: 'turn:turn:numb.viagenie.ca',
                            credential: 'enter1234',
                            username: 'bethin.charles@yahoo.com' }
                        ] };

const peers = {
  // 'userID': {
  //   userID: 'userID',
  //   'peerConnection': 'somePeerConnection'
  // }
}; // peers

let localStream;
const user = {};
const pin = null;

let roomName = '';

function uuid() {
  // Function to generate userID
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function s4() {
  //Helper function to generate userID
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

function getLocalStream(isFront, callback) {
  let videoSourceId;

  // on android, you don't have to specify sourceId manually, just use facingMode
  // uncomment it if you want to specify
  if (Platform.OS === 'ios') {
    MediaStreamTrack.getSources(sourceInfos => {
      console.log('sourceInfos: ', sourceInfos);

      for (const i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (sourceInfo.kind === 'video' && sourceInfo.facing === (isFront ? 'front' : 'back')) {
          videoSourceId = sourceInfo.id;
        }
      }
    });
  }
  getUserMedia({
    audio: true,
    video: {
      mandatory: {
        minWidth: 640, // Provide your own width, height and frame rate here
        minHeight: 360,
        minFrameRate: 30,
      },
      facingMode: (isFront ? 'user' : 'environment'),
      optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
    }
  }, function (stream) {
    console.log('getUserMedia success', stream);
    callback(stream);
  }, logError);
}

function join(roomID) {
  roomName = '#' + roomID;
  console.log('roomID: ', roomName);
  console.log('Connected to Stream Server');
  socket.emit('subscribe', user.userID, roomName, pin);
  console.log('Subscribed to room');
}

function createPC(peerID, isOffer) {
  const pc = new RTCPeerConnection(configuration);
  peers[peerID] = {
    userID: peerID,
    number: (peers.length),
    peerConnection: pc,
  };

  pc.onicecandidate = function (event) {
    console.log('onicecandidate', event.candidate);
    if (event.candidate) {
      socket.emit('signal', { type: 'ice', ice: event.candidate, userID: user.userID }, peerID, roomName);
    }
  };

  function createOffer() {
    pc.createOffer(function (desc) {
      console.log('createOffer', desc);
      pc.setLocalDescription(desc, function () {
        console.log('setLocalDescription', pc.localDescription);
        socket.emit('signal', {
          type: 'sdp',
          sdp: pc.localDescription,
          userID: user.userID
        }, peerID, roomName);
        console.log('Set Local Description:', pc.localDescription)
      }, logError);
      console.log('Created offer.')
    }, logError);
  }

  pc.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }
  pc.oniceconnectionstatechange = function (event) {
    console.log('oniceconnectionstatechange', event.target.iceConnectionState);
    if (event.target.iceConnectionState === 'completed') {
      setTimeout(() => {
        getStats();
      }, 1000);
    }
  };
  pc.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event.target.signalingState);
  };
  pc.onaddstream = function (event) {
    console.log('onaddstream', event.stream);
    container.setState({ info: 'One peer join!' });

    const remoteList = container.state.remoteList;
    remoteList[peerID] = event.stream.toURL();
    container.setState({ remoteList: remoteList });
  };
  pc.onremovestream = function (event) {
    console.log('onremovestream', event.stream);
  };
  pc.addStream(localStream);
  return pc
}

function exchange(data) {
  console.log('Got message: ', data);
  const fromId = data.userID;
  let pc;
  if (fromId in peers && 'peerConnection' in peers[fromId]) {
    pc = peers[fromId].peerConnection;
  } else {
    pc = createPC(fromId, false);
  }

  if (data.sdp) {
    console.log('exchange sdp', data);
    console.log('pc', pc);
    console.log('peer', peers[fromId]);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      console.log('Will set remote description');
      if (pc.remoteDescription.type === 'offer') {
        pc.createAnswer(function (desc) {
          console.log('createAnswer', desc);
          pc.setLocalDescription(desc, function () {
            console.log('setLocalDescription', pc.localDescription);
            socket.emit('signal', {
              type: 'sdp',
              sdp: pc.localDescription,
              userID: user.userID
            }, peers[fromId].userID, roomName);
          }, logError);
        }, logError);
        console.log('Set remote description complete');
      }
    }, logError);
  } else {
    console.log('exchange candidate', data);
    if (data.ice !== undefined) {
      pc.addIceCandidate(new RTCIceCandidate(data.ice));
    }
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  const pc = pcPeers[socketId];
  const viewIndex = pc.viewIndex;
  pc.close();
  delete pcPeers[socketId];

  const remoteList = container.state.remoteList;
  delete remoteList[socketId]
  container.setState({ remoteList: remoteList });
  container.setState({info: 'One peer leave!'});
}

socket.on('signal', function (data) {
  exchange(data);
});

socket.on('leave', function (socketId) {
  leave(socketId);
});

socket.on('connect', function (data) {
  console.log('connect');
  getLocalStream(true, function (stream) {
    localStream = stream;
    container.setState({ selfViewSrc: stream.toURL() });
    container.setState({ status: 'ready', info: 'Please enter or create room ID' });
  });
});

socket.on('publisher ready', function (publisherID, publisherNumber) {
  console.log('publisher ready from: ', publisherID);
  if (!peers.hasOwnProperty(publisherID)) {
    if (user.userID !== publisherID) {
      createPC(publisherID, true);
    }
  }

  console.log('Peers: ', peers)
});

function logError(error) {
  console.log('logError', error);
}

function mapHash(hash, func) {
  const array = [];
  for (const key in hash) {
    const obj = hash[key];
    array.push(func(obj, key));
  }
  return array;
}

function getStats() {
  const pc = peers[Object.keys(peers)[0]];
  if (pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    console.log('track', track);
    pc.getStats(track, function (report) {
      console.log('getStats report', report);
    }, logError);
  }
}

let container;

const RCTWebRTCDemo = React.createClass({
  getInitialState: function() {
    this.ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => true });
    return {
      info: 'Initializing',
      status: 'init',
      roomID: '',
      isFront: true,
      selfViewSrc: null,
      remoteList: {},
      textRoomConnected: false,
      textRoomData: [],
      textRoomValue: '',
    };
  },
  componentDidMount: function() {
    container = this;
    user.userID = uuid();
  },
  _press(event) {
    this.refs.roomID.blur();
    this.setState({status: 'connect', info: 'Connecting'});
    join(this.state.roomID);
  },
  _switchVideoType() {
    const isFront = !this.state.isFront;
    this.setState({isFront});
    getLocalStream(isFront, function(stream) {
      if (localStream) {
        for (const id in pcPeers) {
          const pc = pcPeers[id];
          pc && pc.removeStream(localStream);
        }
        localStream.release();
      }
      localStream = stream;
      container.setState({selfViewSrc: stream.toURL()});

      for (const id in peers) {
        const pc = peers[id];
        pc && pc.addStream(localStream);
      }
    });
  },
  // receiveTextData(data) {
  //   const textRoomData = this.state.textRoomData.slice();
  //   textRoomData.push(data);
  //   this.setState({textRoomData, textRoomValue: ''});
  // },
  // _textRoomPress() {
  //   if (!this.state.textRoomValue) {
  //     return
  //   }
  //   const textRoomData = this.state.textRoomData.slice();
  //   textRoomData.push({ user: 'Me', message: this.state.textRoomValue });
  //   for (const key in pcPeers) {
  //     const pc = pcPeers[key];
  //     pc.textDataChannel.send(this.state.textRoomValue);
  //   }
  //   this.setState({textRoomData, textRoomValue: ''});
  // },
  // _renderTextRoom() {
  //   return (
  //     <View style={styles.listViewContainer}>
  //       <ListView
  //         dataSource={this.ds.cloneWithRows(this.state.textRoomData)}
  //         renderRow={rowData => <Text>{`${rowData.user}: ${rowData.message}`}</Text>}
  //         />
  //       <TextInput
  //         style={{width: 200, height: 30, borderColor: 'gray', borderWidth: 1}}
  //         onChangeText={value => this.setState({textRoomValue: value})}
  //         value={this.state.textRoomValue}
  //       />
  //       <TouchableHighlight
  //         onPress={this._textRoomPress}>
  //         <Text>Send</Text>
  //       </TouchableHighlight>
  //     </View>
  //   );
  // },
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          {this.state.info}
        </Text>
        {this.state.textRoomConnected && this._renderTextRoom()}
        <View style={{flexDirection: 'row'}}>
          <Text>
            {this.state.isFront ? "Use front camera" : "Use back camera"}
          </Text>
          <TouchableHighlight
            style={{borderWidth: 1, borderColor: 'black'}}
            onPress={this._switchVideoType}>
            <Text>Switch camera</Text>
          </TouchableHighlight>
        </View>
        { this.state.status == 'ready' ?
          (<View>
            <TextInput
              ref='roomID'
              autoCorrect={false}
              style={{width: 200, height: 40, borderColor: 'gray', borderWidth: 1}}
              onChangeText={(text) => this.setState({roomID: text})}
              value={this.state.roomID}
            />
            <TouchableHighlight
              onPress={this._press}>
              <Text>Enter room</Text>
            </TouchableHighlight>
          </View>) : null
        }
        <RTCView streamURL={this.state.selfViewSrc} style={styles.selfView}/>
        {
          mapHash(this.state.remoteList, function(remote, index) {
            return <RTCView key={index} streamURL={remote} style={styles.remoteView}/>
          })
        }
      </View>
    );
  }
});

const styles = StyleSheet.create({
  selfView: {
    width: 200,
    height: 150,
  },
  remoteView: {
    width: 200,
    height: 150,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  listViewContainer: {
    height: 150,
  },
});

AppRegistry.registerComponent('RCTWebRTCDemo', () => RCTWebRTCDemo);
