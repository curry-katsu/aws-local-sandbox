<template>
  <div class="service-console">
    <v-sheet border rounded="lg" class="side-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">SQS queues</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Send, receive, delete, and tune local queue settings.
          </p>
        </div>
        <div class="panel-actions">
          <v-btn variant="tonal" icon="mdi-refresh" :loading="loadingQueues" @click="loadQueues" />
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateQueue">
            New queue
          </v-btn>
        </div>
      </div>

      <v-alert v-if="error" class="mx-4 mb-4" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert v-if="statusMessage" class="mx-4 mb-4" type="info" variant="tonal" density="comfortable">
        {{ statusMessage }}
      </v-alert>

      <v-list density="compact" nav>
        <v-list-item
          v-if="!loadingQueues && queues.length === 0"
          title="No SQS queues found"
          subtitle="Run Terraform apply to create local resources."
        />
        <v-list-item
          v-for="queue in queues"
          :key="queue.url"
          :active="selectedQueueUrl === queue.url"
          prepend-icon="mdi-message"
          :title="queue.name"
          :subtitle="queue.url"
          @click="selectQueue(queue.url)"
        />
      </v-list>
    </v-sheet>

    <v-sheet v-if="isCreatingQueue" border rounded="lg" class="main-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">Create SQS queue</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Create one local queue, then return to the selected queue detail.
          </p>
        </div>
      </div>

      <v-divider />

      <div class="create-panel">
        <v-text-field
          v-model="newQueueName"
          label="Queue name"
          density="comfortable"
          variant="outlined"
          hide-details="auto"
        />
        <v-alert v-if="queueNameAlreadyExists" type="info" variant="tonal" density="comfortable">
          A queue with this name already exists. Select the existing queue instead of creating another.
        </v-alert>
        <div class="editor-actions">
          <v-btn variant="text" @click="cancelCreateQueue">Cancel</v-btn>
          <v-btn
            v-if="queueNameAlreadyExists"
            variant="tonal"
            prepend-icon="mdi-open-in-new"
            @click="selectExistingQueueByName"
          >
            Open existing
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            :disabled="!newQueueName.trim() || queueNameAlreadyExists"
            :loading="creatingQueue"
            @click="createQueueFromForm"
          >
            Create queue
          </v-btn>
        </div>
      </div>
    </v-sheet>

    <v-sheet v-else border rounded="lg" class="main-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">{{ selectedQueueName || 'Select a queue' }}</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            {{ selectedQueueUrl || 'Choose a queue from the left panel.' }}
          </p>
        </div>
        <div class="panel-actions">
          <v-btn variant="tonal" prepend-icon="mdi-download-outline" :disabled="!selectedQueueUrl" :loading="receiving" @click="receiveMessages">
            Receive
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-send-outline" :disabled="!selectedQueueUrl" :loading="sending" @click="sendMessage">
            Send
          </v-btn>
          <v-btn variant="tonal" color="error" prepend-icon="mdi-delete-outline" :disabled="!selectedQueueUrl" @click="deleteQueueDialog = true">
            Delete
          </v-btn>
        </div>
      </div>

      <v-divider />

      <div v-if="!selectedQueueUrl" class="empty-state">
        <v-icon icon="mdi-message-outline" size="44" />
        <div class="text-body-1 font-weight-medium">Choose an SQS queue</div>
        <div class="text-body-2 text-medium-emphasis">Messages, attributes, and tuning controls appear here.</div>
      </div>

      <template v-else>
        <div class="summary-grid">
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Visible</div>
            <div class="text-body-2 font-weight-medium">{{ attributes.ApproximateNumberOfMessages || '0' }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">In flight</div>
            <div class="text-body-2 font-weight-medium">{{ attributes.ApproximateNumberOfMessagesNotVisible || '0' }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Wait time</div>
            <div class="text-body-2 font-weight-medium">{{ attributes.ReceiveMessageWaitTimeSeconds || '0' }}s</div>
          </div>
        </div>

        <v-tabs v-model="activeTab" density="comfortable">
          <v-tab value="messages">Messages</v-tab>
          <v-tab value="send">Send</v-tab>
          <v-tab value="attributes">Attributes</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="messages">
            <div class="toolbar">
              <v-text-field v-model.number="receiveCount" label="Max messages" type="number" min="1" max="10" density="compact" variant="outlined" hide-details />
              <v-btn variant="tonal" prepend-icon="mdi-delete-outline" color="error" :disabled="selectedMessageIndex === null" @click="deleteMessageDialog = true">
                Delete selected
              </v-btn>
            </div>

            <v-table density="compact" class="data-table">
              <thead>
                <tr>
                  <th>Message ID</th>
                  <th>Body</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="messages.length === 0">
                  <td colspan="2" class="text-medium-emphasis">No messages loaded.</td>
                </tr>
                <tr
                  v-for="(message, index) in messages"
                  :key="message.MessageId || index"
                  :class="{ 'selected-row': selectedMessageIndex === index }"
                  @click="selectedMessageIndex = index"
                >
                  <td class="mono">{{ message.MessageId }}</td>
                  <td class="mono">{{ message.Body }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="send">
            <div class="editor-panel">
              <v-textarea v-model="messageBody" label="Message body" density="comfortable" variant="outlined" rows="10" hide-details="auto" />
              <div class="editor-actions">
                <v-btn variant="tonal" prepend-icon="mdi-file-code-outline" @click="resetMessage">Reset sample</v-btn>
                <v-btn color="primary" prepend-icon="mdi-send-outline" :loading="sending" @click="sendMessage">Send message</v-btn>
              </div>
            </div>
          </v-window-item>

          <v-window-item value="attributes">
            <div class="settings-grid">
              <v-text-field v-model="settings.VisibilityTimeout" label="Visibility timeout seconds" type="number" density="comfortable" variant="outlined" hide-details="auto" />
              <v-text-field v-model="settings.MessageRetentionPeriod" label="Message retention seconds" type="number" density="comfortable" variant="outlined" hide-details="auto" />
              <v-text-field v-model="settings.DelaySeconds" label="Delay seconds" type="number" density="comfortable" variant="outlined" hide-details="auto" />
              <v-text-field v-model="settings.ReceiveMessageWaitTimeSeconds" label="Receive wait time seconds" type="number" density="comfortable" variant="outlined" hide-details="auto" />
            </div>
            <div class="editor-actions settings-actions">
              <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loadingAttributes" @click="loadAttributes">Reload attributes</v-btn>
              <v-btn color="primary" prepend-icon="mdi-content-save-outline" :loading="savingAttributes" @click="saveAttributes">Save attributes</v-btn>
            </div>
            <v-expansion-panels class="raw-panel" variant="accordion">
              <v-expansion-panel title="Raw attributes">
                <v-expansion-panel-text>
                  <pre>{{ formatJson(attributes) }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-window-item>
        </v-window>
      </template>
    </v-sheet>

    <v-dialog v-model="deleteMessageDialog" max-width="520">
      <v-card>
        <v-card-title>Delete SQS message</v-card-title>
        <v-card-text>
          Delete the selected received message from <strong>{{ selectedQueueName }}</strong>.
          This requires the receipt handle from the current receive result.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteMessageDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingMessage" @click="deleteSelectedMessage">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteQueueDialog" max-width="520">
      <v-card>
        <v-card-title>Delete SQS queue</v-card-title>
        <v-card-text>
          Delete <strong>{{ selectedQueueName }}</strong>. This removes the local queue and its messages from Floci.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteQueueDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingQueue" @click="deleteSelectedQueue">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createQueue,
  deleteQueue,
  deleteQueueMessage,
  getQueueAttributes,
  listQueues,
  receiveQueueMessages,
  sendQueueMessage,
  setQueueAttributes,
} from '../aws/sqs'

const queues = ref([])
const selectedQueueUrl = ref('')
const messages = ref([])
const attributes = ref({})
const activeTab = ref('messages')
const isCreatingQueue = ref(false)
const receiveCount = ref(5)
const selectedMessageIndex = ref(null)
const messageBody = ref('')
const newQueueName = ref('aws-local-sandbox-gui-queue')
const loadingQueues = ref(false)
const loadingAttributes = ref(false)
const creatingQueue = ref(false)
const deletingQueue = ref(false)
const receiving = ref(false)
const sending = ref(false)
const savingAttributes = ref(false)
const deletingMessage = ref(false)
const deleteMessageDialog = ref(false)
const deleteQueueDialog = ref(false)
const error = ref('')
const statusMessage = ref('')
const settings = reactive({
  VisibilityTimeout: '',
  MessageRetentionPeriod: '',
  DelaySeconds: '',
  ReceiveMessageWaitTimeSeconds: '',
})

const selectedQueueName = computed(() => selectedQueueUrl.value.split('/').pop() || '')
const queueNameAlreadyExists = computed(() =>
  queues.value.some((queue) => queue.name === newQueueName.value.trim()),
)
const selectedMessage = computed(() => {
  if (selectedMessageIndex.value === null) return null
  return messages.value[selectedMessageIndex.value] || null
})

async function loadQueues() {
  loadingQueues.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    queues.value = await listQueues()
    if (!selectedQueueUrl.value && queues.value.length > 0) {
      await selectQueue(queues.value[0].url)
    } else if (selectedQueueUrl.value && !queues.value.some((queue) => queue.url === selectedQueueUrl.value)) {
      resetSelection()
    }
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load SQS queues.')
  } finally {
    loadingQueues.value = false
  }
}

async function selectQueue(queueUrl) {
  isCreatingQueue.value = false
  selectedQueueUrl.value = queueUrl
  messages.value = []
  selectedMessageIndex.value = null
  activeTab.value = 'messages'
  resetMessage()
  await loadAttributes()
}

function openCreateQueue() {
  isCreatingQueue.value = true
  error.value = ''
  statusMessage.value = ''
  newQueueName.value = nextQueueName()
}

function cancelCreateQueue() {
  isCreatingQueue.value = false
}

async function selectExistingQueueByName() {
  const existingQueue = queues.value.find((queue) => queue.name === newQueueName.value.trim())
  if (existingQueue?.url) {
    await selectQueue(existingQueue.url)
  }
}

async function loadAttributes() {
  if (!selectedQueueUrl.value) return
  loadingAttributes.value = true
  error.value = ''

  try {
    attributes.value = await getQueueAttributes(selectedQueueUrl.value)
    settings.VisibilityTimeout = attributes.value.VisibilityTimeout || ''
    settings.MessageRetentionPeriod = attributes.value.MessageRetentionPeriod || ''
    settings.DelaySeconds = attributes.value.DelaySeconds || ''
    settings.ReceiveMessageWaitTimeSeconds = attributes.value.ReceiveMessageWaitTimeSeconds || ''
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load SQS attributes.')
  } finally {
    loadingAttributes.value = false
  }
}

async function receiveMessages() {
  if (!selectedQueueUrl.value) return
  receiving.value = true
  error.value = ''
  statusMessage.value = ''
  selectedMessageIndex.value = null

  try {
    messages.value = await receiveQueueMessages(selectedQueueUrl.value, normalizedReceiveCount())
    statusMessage.value = `Received ${messages.value.length} message(s) from ${selectedQueueName.value}.`
    await loadAttributes()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to receive SQS messages.')
  } finally {
    receiving.value = false
  }
}

async function sendMessage() {
  if (!selectedQueueUrl.value) return
  sending.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await sendQueueMessage(selectedQueueUrl.value, messageBody.value)
    statusMessage.value = `Sent message to ${selectedQueueName.value}.`
    activeTab.value = 'messages'
    await loadAttributes()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to send SQS message.')
  } finally {
    sending.value = false
  }
}

async function deleteSelectedMessage() {
  if (!selectedQueueUrl.value || !selectedMessage.value?.ReceiptHandle) return
  deletingMessage.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await deleteQueueMessage(selectedQueueUrl.value, selectedMessage.value.ReceiptHandle)
    deleteMessageDialog.value = false
    statusMessage.value = `Deleted message from ${selectedQueueName.value}.`
    await receiveMessages()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete SQS message.')
  } finally {
    deletingMessage.value = false
  }
}

async function saveAttributes() {
  if (!selectedQueueUrl.value) return
  savingAttributes.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await setQueueAttributes(selectedQueueUrl.value, settings)
    statusMessage.value = `Saved attributes for ${selectedQueueName.value}.`
    await loadAttributes()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to save SQS attributes.')
  } finally {
    savingAttributes.value = false
  }
}

async function createQueueFromForm() {
  if (!newQueueName.value.trim()) {
    error.value = 'Queue name is required.'
    return
  }

  creatingQueue.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const queueUrl = await createQueue(newQueueName.value.trim())
    statusMessage.value = `Created ${newQueueName.value.trim()}.`
    await loadQueues()
    if (queueUrl) await selectQueue(queueUrl)
    isCreatingQueue.value = false
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to create SQS queue.')
  } finally {
    creatingQueue.value = false
  }
}

async function deleteSelectedQueue() {
  if (!selectedQueueUrl.value) return
  deletingQueue.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const deletedName = selectedQueueName.value
    await deleteQueue(selectedQueueUrl.value)
    deleteQueueDialog.value = false
    resetSelection()
    statusMessage.value = `Deleted ${deletedName}.`
    await loadQueues()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete SQS queue.')
  } finally {
    deletingQueue.value = false
  }
}

function resetSelection() {
  isCreatingQueue.value = false
  selectedQueueUrl.value = ''
  messages.value = []
  attributes.value = {}
  selectedMessageIndex.value = null
}

function resetMessage() {
  messageBody.value = JSON.stringify({ source: 'gui', message: 'hello from SQS console' }, null, 2)
}

function normalizedReceiveCount() {
  const parsed = Number(receiveCount.value)
  if (!Number.isFinite(parsed)) return 5
  return Math.min(Math.max(Math.trunc(parsed), 1), 10)
}

function nextQueueName() {
  const baseName = 'aws-local-sandbox-gui-queue'
  if (!queues.value.some((queue) => queue.name === baseName)) {
    return baseName
  }

  let index = 2
  while (queues.value.some((queue) => queue.name === `${baseName}-${index}`)) {
    index += 1
  }
  return `${baseName}-${index}`
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadQueues)
</script>

<style scoped>
.service-console {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
}

.side-panel,
.main-panel {
  min-width: 0;
}

.panel-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.panel-actions,
.create-panel,
.editor-actions,
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.create-panel {
  align-items: stretch;
  flex-direction: column;
  padding: 16px;
}

.create-panel :deep(.v-input) {
  max-width: 520px;
}

.empty-state {
  align-items: center;
  display: grid;
  gap: 8px;
  justify-items: center;
  min-height: 360px;
  padding: 24px;
  text-align: center;
}

.summary-grid,
.settings-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px;
}

.settings-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.summary-cell {
  background: rgba(var(--v-theme-surface-variant), 0.36);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

.toolbar {
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.toolbar :deep(.v-input) {
  flex: 0 0 180px;
}

.data-table {
  padding: 0 16px 16px;
}

.selected-row {
  background: rgba(var(--v-theme-primary), 0.08);
}

.editor-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.settings-actions,
.raw-panel {
  padding: 0 16px 16px;
}

.mono,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

pre {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .service-console {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .panel-header,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-grid,
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
