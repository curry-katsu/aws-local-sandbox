<template>
  <div class="service-console">
    <v-sheet border rounded="lg" class="side-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">SNS topics</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Publish messages and inspect local subscriptions.
          </p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loadingTopics" @click="loadTopics">
          Refresh
        </v-btn>
      </div>

      <div class="create-topic">
        <v-text-field v-model="newTopicName" label="New topic name" density="compact" variant="outlined" hide-details />
        <v-btn variant="tonal" prepend-icon="mdi-plus" :loading="creatingTopic" @click="createTopic">Create</v-btn>
      </div>

      <v-alert v-if="error" class="mx-4 mb-4" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert v-if="statusMessage" class="mx-4 mb-4" type="info" variant="tonal" density="comfortable">
        {{ statusMessage }}
      </v-alert>

      <v-list density="compact" nav>
        <v-list-item
          v-if="!loadingTopics && topics.length === 0"
          title="No SNS topics found"
          subtitle="Run Terraform apply or create one here."
        />
        <v-list-item
          v-for="topic in topics"
          :key="topic.TopicArn"
          :active="selectedTopicArn === topic.TopicArn"
          prepend-icon="mdi-bullhorn"
          :title="topicName(topic.TopicArn)"
          :subtitle="topic.TopicArn"
          @click="selectTopic(topic.TopicArn)"
        />
      </v-list>
    </v-sheet>

    <v-sheet border rounded="lg" class="main-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">{{ selectedTopicName || 'Select a topic' }}</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            {{ selectedTopicArn || 'Choose a topic from the left panel.' }}
          </p>
        </div>
        <div class="panel-actions">
          <v-btn variant="tonal" prepend-icon="mdi-refresh" :disabled="!selectedTopicArn" :loading="loadingTopicDetail" @click="loadTopicDetail">
            Refresh
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-send-outline" :disabled="!selectedTopicArn" :loading="publishing" @click="publishMessage">
            Publish
          </v-btn>
        </div>
      </div>

      <v-divider />

      <div v-if="!selectedTopicArn" class="empty-state">
        <v-icon icon="mdi-bullhorn-outline" size="44" />
        <div class="text-body-1 font-weight-medium">Choose an SNS topic</div>
        <div class="text-body-2 text-medium-emphasis">Publish, subscriptions, and attributes appear here.</div>
      </div>

      <template v-else>
        <div class="summary-grid">
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Subscriptions</div>
            <div class="text-body-2 font-weight-medium">{{ subscriptions.length }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Display name</div>
            <div class="text-body-2 font-weight-medium">{{ attributes.DisplayName || 'None' }}</div>
          </div>
          <div class="summary-cell">
            <div class="text-caption text-medium-emphasis">Owner</div>
            <div class="text-body-2 font-weight-medium">{{ attributes.Owner || 'Unknown' }}</div>
          </div>
        </div>

        <v-tabs v-model="activeTab" density="comfortable">
          <v-tab value="publish">Publish</v-tab>
          <v-tab value="subscriptions">Subscriptions</v-tab>
          <v-tab value="attributes">Attributes</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="publish">
            <div class="editor-panel">
              <v-text-field v-model="subject" label="Subject" density="comfortable" variant="outlined" hide-details="auto" />
              <v-textarea v-model="message" label="Message" density="comfortable" variant="outlined" rows="10" hide-details="auto" />
              <div class="editor-actions">
                <v-btn variant="tonal" prepend-icon="mdi-file-code-outline" @click="resetMessage">Reset sample</v-btn>
                <v-btn color="primary" prepend-icon="mdi-send-outline" :loading="publishing" @click="publishMessage">Publish message</v-btn>
              </div>
            </div>
          </v-window-item>

          <v-window-item value="subscriptions">
            <v-table density="compact" class="data-table">
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>Endpoint</th>
                  <th>Subscription ARN</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subscriptions.length === 0">
                  <td colspan="3" class="text-medium-emphasis">No subscriptions loaded.</td>
                </tr>
                <tr v-for="subscription in subscriptions" :key="subscription.SubscriptionArn || subscription.Endpoint">
                  <td>{{ subscription.Protocol }}</td>
                  <td class="mono">{{ subscription.Endpoint }}</td>
                  <td class="mono">{{ subscription.SubscriptionArn }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <v-window-item value="attributes">
            <div class="settings-grid">
              <v-text-field v-model="displayName" label="Display name" density="comfortable" variant="outlined" hide-details="auto" />
              <v-btn color="primary" prepend-icon="mdi-content-save-outline" :loading="savingAttribute" @click="saveDisplayName">
                Save display name
              </v-btn>
              <v-btn variant="tonal" color="error" prepend-icon="mdi-delete-outline" @click="deleteTopicDialog = true">
                Delete topic
              </v-btn>
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

    <v-dialog v-model="deleteTopicDialog" max-width="520">
      <v-card>
        <v-card-title>Delete SNS topic</v-card-title>
        <v-card-text>
          Delete <strong>{{ selectedTopicName }}</strong>. This only affects the local Floci store.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTopicDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingTopic" @click="deleteTopic">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createTopic as createSnsTopic,
  deleteTopic as deleteSnsTopic,
  getTopicDetail,
  listTopics,
  publishTopicMessage,
  setTopicDisplayName,
} from '../aws/sns'

const topics = ref([])
const selectedTopicArn = ref('')
const attributes = ref({})
const subscriptions = ref([])
const activeTab = ref('publish')
const subject = ref('Message from GUI')
const message = ref('')
const displayName = ref('')
const newTopicName = ref('aws-local-sandbox-gui-topic')
const loadingTopics = ref(false)
const loadingTopicDetail = ref(false)
const publishing = ref(false)
const savingAttribute = ref(false)
const creatingTopic = ref(false)
const deletingTopic = ref(false)
const deleteTopicDialog = ref(false)
const error = ref('')
const statusMessage = ref('')

const selectedTopicName = computed(() => topicName(selectedTopicArn.value))

async function loadTopics() {
  loadingTopics.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    topics.value = await listTopics()
    if (!selectedTopicArn.value && topics.value.length > 0) {
      await selectTopic(topics.value[0].TopicArn)
    } else if (selectedTopicArn.value && !topics.value.some((topic) => topic.TopicArn === selectedTopicArn.value)) {
      resetSelection()
    }
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load SNS topics.')
  } finally {
    loadingTopics.value = false
  }
}

async function selectTopic(topicArn) {
  selectedTopicArn.value = topicArn
  activeTab.value = 'publish'
  resetMessage()
  await loadTopicDetail()
}

async function loadTopicDetail() {
  if (!selectedTopicArn.value) return
  loadingTopicDetail.value = true
  error.value = ''

  try {
    const detail = await getTopicDetail(selectedTopicArn.value)
    attributes.value = detail.attributes
    displayName.value = attributes.value.DisplayName || ''
    subscriptions.value = detail.subscriptions
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load SNS topic detail.')
  } finally {
    loadingTopicDetail.value = false
  }
}

async function publishMessage() {
  if (!selectedTopicArn.value) return
  publishing.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await publishTopicMessage(selectedTopicArn.value, subject.value, message.value)
    statusMessage.value = `Published message to ${selectedTopicName.value}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to publish SNS message.')
  } finally {
    publishing.value = false
  }
}

async function saveDisplayName() {
  if (!selectedTopicArn.value) return
  savingAttribute.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await setTopicDisplayName(selectedTopicArn.value, displayName.value)
    statusMessage.value = `Saved display name for ${selectedTopicName.value}.`
    await loadTopicDetail()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to save SNS attribute.')
  } finally {
    savingAttribute.value = false
  }
}

async function createTopic() {
  if (!newTopicName.value.trim()) {
    error.value = 'Topic name is required.'
    return
  }

  creatingTopic.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const topicArn = await createSnsTopic(newTopicName.value.trim())
    statusMessage.value = `Created ${newTopicName.value.trim()}.`
    await loadTopics()
    if (topicArn) await selectTopic(topicArn)
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to create SNS topic.')
  } finally {
    creatingTopic.value = false
  }
}

async function deleteTopic() {
  if (!selectedTopicArn.value) return
  deletingTopic.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    const deletedName = selectedTopicName.value
    await deleteSnsTopic(selectedTopicArn.value)
    deleteTopicDialog.value = false
    resetSelection()
    statusMessage.value = `Deleted ${deletedName}.`
    await loadTopics()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete SNS topic.')
  } finally {
    deletingTopic.value = false
  }
}

function resetSelection() {
  selectedTopicArn.value = ''
  attributes.value = {}
  subscriptions.value = []
  displayName.value = ''
}

function resetMessage() {
  subject.value = 'Message from GUI'
  message.value = JSON.stringify({ source: 'gui', message: 'hello from SNS console' }, null, 2)
}

function topicName(topicArn) {
  return topicArn?.split(':').pop() || ''
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadTopics)
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

.create-topic,
.panel-actions,
.editor-actions,
.settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.create-topic {
  padding: 0 16px 16px;
}

.create-topic :deep(.v-input) {
  flex: 1 1 180px;
}

.panel-actions,
.editor-actions {
  justify-content: flex-end;
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

.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px;
}

.summary-cell {
  background: rgba(var(--v-theme-surface-variant), 0.36);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

.data-table,
.raw-panel,
.settings-grid {
  padding: 16px;
}

.settings-grid {
  align-items: center;
}

.settings-grid :deep(.v-input) {
  flex: 1 1 260px;
}

.editor-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
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
  .panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
