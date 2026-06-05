Component({
  properties: {
    winner: { type: Object, value: null },      // { nickname, finalScore }
    loser: { type: Object, value: null },        // { nickname, finalScore }
    maxSingle: { type: Number, value: 0 },
    totalTransfer: { type: Number, value: 0 },
    transferCount: { type: Number, value: 0 },
    memberCount: { type: Number, value: 0 },
    roomNo: { type: String, value: '' },
    settleTime: { type: String, value: '' }
  }
})
