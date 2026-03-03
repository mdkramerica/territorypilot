/**
 * Voice recording modal — MediaRecorder, upload, transcript display
 */

let mediaRecorder = null;
let audioChunks = [];
let recInterval = null;
let recStartTime = 0;
let voiceAccountId = null;

function openVoiceLog(accountId, accountName) {
  voiceAccountId = accountId;
  const modal = document.getElementById('voice-modal');
  const actionBtn = document.getElementById('voice-action');

  document.getElementById('voice-modal-title').textContent = `Voice Log — ${accountName}`;
  modal.classList.add('show');
  document.getElementById('voice-result').style.display = 'none';
  document.getElementById('rec-indicator').style.display = 'none';
  document.getElementById('rec-time').style.display = 'none';
  document.getElementById('voice-modal-sub').textContent =
    'Tap to start recording your call notes.';

  // Reset button state properly (fixes issue #4.7)
  actionBtn.textContent = 'Start Recording';
  actionBtn.className = 'btn btn-accent';
  actionBtn.disabled = false;
  actionBtn.onclick = handleVoiceAction;
}

function closeVoiceModal() {
  stopRecording(false);
  document.getElementById('voice-modal').classList.remove('show');
}

document.getElementById('voice-cancel').addEventListener('click', closeVoiceModal);

async function handleVoiceAction() {
  const actionBtn = document.getElementById('voice-action');

  if (actionBtn.textContent === 'Start Recording') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.start();
      recStartTime = Date.now();
      document.getElementById('rec-indicator').style.display = 'inline-flex';
      document.getElementById('rec-time').style.display = 'block';
      document.getElementById('voice-modal-sub').textContent = 'Recording...';
      actionBtn.textContent = 'Stop & Submit';
      actionBtn.className = 'btn btn-green';
      recInterval = setInterval(() => {
        const secs = Math.floor((Date.now() - recStartTime) / 1000);
        document.getElementById('rec-time').textContent = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
      }, 250);
    } catch {
      toast('Microphone access denied');
    }
  } else if (actionBtn.textContent === 'Stop & Submit') {
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="spinner"></span> Processing';
    stopRecording(true);
  } else if (actionBtn.textContent === 'Done') {
    closeVoiceModal();
  }
}

function stopRecording(submit) {
  if (recInterval) {
    clearInterval(recInterval);
    recInterval = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = async () => {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      if (submit) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('accountId', voiceAccountId);
        try {
          const res = await fetch(`${API}/api/log/voice`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
          });
          const data = await res.json();
          document.getElementById('voice-transcript').textContent = data.transcript || '';
          document.getElementById('voice-summary').textContent = data.summary || '';
          document.getElementById('voice-result').style.display = 'block';
          document.getElementById('voice-modal-sub').textContent = 'Logged successfully!';
        } catch {
          toast('Voice log failed');
        }
        const actionBtn = document.getElementById('voice-action');
        actionBtn.disabled = false;
        actionBtn.textContent = 'Done';
        actionBtn.className = 'btn btn-accent';
        actionBtn.onclick = handleVoiceAction;
      }
    };
    mediaRecorder.stop();
  }
  document.getElementById('rec-indicator').style.display = 'none';
}
