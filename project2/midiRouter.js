// midiRouter.js
export default class MidiRouter {
  constructor({ onNanoPAD=()=>{}, onNanoKEY=()=>{}, onNanoKONTROL=()=>{} } = {}) {
    this.onNanoPAD = onNanoPAD;
    this.onNanoKEY = onNanoKEY;
    this.onNanoKONTROL = onNanoKONTROL;
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      console.log("MIDI not supported");
      return;
    }
    const access = await navigator.requestMIDIAccess();
    access.inputs.forEach(input => {
      console.log("MIDI connected:", input.name);
      input.onmidimessage = (e) => this._onMsg(input.name, e.data);
    });
  }

  _onMsg(name, data) {
    const [st, d1, d2] = data;
    const type = st & 0xF0;

    // normalize
    if (name.toLowerCase().includes("nanopad")) {
      if (type === 0x90) this.onNanoPAD({type:"noteon", note:d1, value:d2});
    } else if (name.toLowerCase().includes("nanokey")) {
      if (type === 0x90) this.onNanoKEY({type:"noteon", note:d1, value:d2});
    } else if (name.toLowerCase().includes("nanokontrol")) {
      if (type === 0xB0) this.onNanoKONTROL({type:"cc", cc:d1, value:d2});
    }
  }
}
