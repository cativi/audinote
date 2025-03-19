import sys
import wave
import json
from vosk import Model, KaldiRecognizer

# Get arguments
AUDIO_FILE = sys.argv[1]
MODEL_PATH = sys.argv[2]

# Load the model
model = Model(MODEL_PATH)
wf = wave.open(AUDIO_FILE, "rb")
rec = KaldiRecognizer(model, wf.getframerate())

result_text = ""
while True:
    data = wf.readframes(4000)
    if len(data) == 0:
        break
    if rec.AcceptWaveform(data):
        result = json.loads(rec.Result())
        result_text += result.get("text", "") + " "

print(result_text)

