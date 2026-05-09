<template>
  <div class="service-console">
    <v-sheet border rounded="lg" class="side-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">S3 buckets</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            Browse and edit local bucket objects.
          </p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loadingBuckets" @click="loadBuckets">
          Refresh
        </v-btn>
      </div>

      <v-alert v-if="error" class="mx-4 mb-4" type="error" variant="tonal" density="comfortable">
        {{ error }}
      </v-alert>
      <v-alert v-if="statusMessage" class="mx-4 mb-4" type="info" variant="tonal" density="comfortable">
        {{ statusMessage }}
      </v-alert>

      <v-list density="compact" nav>
        <v-list-item
          v-if="!loadingBuckets && buckets.length === 0"
          title="No S3 buckets found"
          subtitle="Run Terraform apply to create local resources."
        />
        <v-list-item
          v-for="bucket in buckets"
          :key="bucket.Name"
          :active="selectedBucket === bucket.Name"
          prepend-icon="mdi-bucket"
          :title="bucket.Name"
          @click="selectBucket(bucket.Name)"
        />
      </v-list>
    </v-sheet>

    <v-sheet border rounded="lg" class="main-panel">
      <div class="panel-header">
        <div>
          <h2 class="text-h6">{{ selectedBucket || 'Select a bucket' }}</h2>
          <p class="text-body-2 text-medium-emphasis ma-0">
            {{ selectedBucket ? `${objects.length} object(s) loaded` : 'Choose a bucket from the left panel.' }}
          </p>
        </div>
        <div class="panel-actions">
          <v-btn variant="tonal" prepend-icon="mdi-folder-search-outline" :disabled="!selectedBucket" :loading="loadingObjects" @click="loadObjects">
            List
          </v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" :disabled="!selectedBucket" @click="prepareObject">
            Add object
          </v-btn>
        </div>
      </div>

      <v-divider />

      <div v-if="!selectedBucket" class="empty-state">
        <v-icon icon="mdi-bucket-outline" size="44" />
        <div class="text-body-1 font-weight-medium">Choose an S3 bucket</div>
        <div class="text-body-2 text-medium-emphasis">Object listing, preview, and writes appear here.</div>
      </div>

      <template v-else>
        <v-tabs v-model="activeTab" density="comfortable">
          <v-tab value="objects">Objects</v-tab>
          <v-tab value="editor">Editor</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="objects">
            <div class="toolbar">
              <v-text-field
                v-model="prefix"
                label="Prefix"
                density="compact"
                variant="outlined"
                hide-details
                @keyup.enter="loadObjects"
              />
              <v-btn variant="tonal" prepend-icon="mdi-delete-outline" color="error" :disabled="!selectedObjectKey" @click="deleteDialog = true">
                Delete selected
              </v-btn>
            </div>

            <v-table density="compact" class="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Size</th>
                  <th>Last modified</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!loadingObjects && objects.length === 0">
                  <td colspan="3" class="text-medium-emphasis">No objects loaded.</td>
                </tr>
                <tr
                  v-for="object in objects"
                  :key="object.Key"
                  :class="{ 'selected-row': selectedObjectKey === object.Key }"
                  @click="selectObject(object.Key)"
                >
                  <td class="mono">{{ object.Key }}</td>
                  <td>{{ object.Size ?? 0 }}</td>
                  <td>{{ formatDate(object.LastModified) }}</td>
                </tr>
              </tbody>
            </v-table>

            <v-expansion-panels v-if="selectedObjectKey" class="preview-panel" variant="accordion">
              <v-expansion-panel :title="`Preview: ${selectedObjectKey}`">
                <v-expansion-panel-text>
                  <pre>{{ objectPreview }}</pre>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-window-item>

          <v-window-item value="editor">
            <div class="editor-panel">
              <v-text-field v-model="objectKey" label="Object key" density="comfortable" variant="outlined" hide-details="auto" />
              <v-text-field v-model="contentType" label="Content type" density="comfortable" variant="outlined" hide-details="auto" />
              <v-textarea v-model="objectBody" label="Object body" density="comfortable" variant="outlined" rows="12" hide-details="auto" />
              <div class="editor-actions">
                <v-btn variant="tonal" prepend-icon="mdi-file-code-outline" @click="prepareObject">Reset sample</v-btn>
                <v-btn color="primary" prepend-icon="mdi-content-save-outline" :loading="savingObject" @click="putObject">Put object</v-btn>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </template>
    </v-sheet>

    <v-dialog v-model="deleteDialog" max-width="520">
      <v-card>
        <v-card-title>Delete S3 object</v-card-title>
        <v-card-text>
          Delete <strong>{{ selectedObjectKey }}</strong> from <strong>{{ selectedBucket }}</strong>.
          This only affects the local Floci store.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="deletingObject" @click="deleteObject">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  deleteObject as deleteS3Object,
  getObjectText,
  listBuckets,
  listObjects,
  putTextObject,
} from '../aws/s3'

const buckets = ref([])
const objects = ref([])
const selectedBucket = ref('')
const selectedObjectKey = ref('')
const objectPreview = ref('')
const prefix = ref('')
const objectKey = ref('')
const objectBody = ref('')
const contentType = ref('application/json')
const activeTab = ref('objects')
const loadingBuckets = ref(false)
const loadingObjects = ref(false)
const savingObject = ref(false)
const deletingObject = ref(false)
const deleteDialog = ref(false)
const error = ref('')
const statusMessage = ref('')

async function loadBuckets() {
  loadingBuckets.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    buckets.value = await listBuckets()
    if (!selectedBucket.value && buckets.value.length > 0) {
      await selectBucket(buckets.value[0].Name)
    }
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to load S3 buckets.')
  } finally {
    loadingBuckets.value = false
  }
}

async function selectBucket(bucketName) {
  selectedBucket.value = bucketName
  selectedObjectKey.value = ''
  objectPreview.value = ''
  activeTab.value = 'objects'
  await loadObjects()
}

async function loadObjects() {
  if (!selectedBucket.value) return
  loadingObjects.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    objects.value = await listObjects(selectedBucket.value, prefix.value)
    statusMessage.value = `Loaded ${objects.value.length} object(s) from ${selectedBucket.value}.`
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to list S3 objects.')
  } finally {
    loadingObjects.value = false
  }
}

async function selectObject(key) {
  selectedObjectKey.value = key
  objectPreview.value = 'Loading...'
  error.value = ''

  try {
    objectPreview.value = await getObjectText(selectedBucket.value, key)
  } catch (caught) {
    objectPreview.value = ''
    error.value = messageFromError(caught, 'Failed to load S3 object.')
  }
}

function prepareObject() {
  activeTab.value = 'editor'
  objectKey.value = `gui/sample-${Date.now()}.json`
  contentType.value = 'application/json'
  objectBody.value = JSON.stringify({ source: 'gui', message: 'hello from S3 console' }, null, 2)
}

async function putObject() {
  if (!selectedBucket.value) return
  if (!objectKey.value.trim()) {
    error.value = 'Object key is required.'
    return
  }

  savingObject.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await putTextObject(selectedBucket.value, objectKey.value.trim(), objectBody.value, contentType.value)
    statusMessage.value = `Saved ${objectKey.value.trim()} to ${selectedBucket.value}.`
    activeTab.value = 'objects'
    await loadObjects()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to put S3 object.')
  } finally {
    savingObject.value = false
  }
}

async function deleteObject() {
  if (!selectedBucket.value || !selectedObjectKey.value) return
  deletingObject.value = true
  error.value = ''
  statusMessage.value = ''

  try {
    await deleteS3Object(selectedBucket.value, selectedObjectKey.value)
    statusMessage.value = `Deleted ${selectedObjectKey.value}.`
    selectedObjectKey.value = ''
    objectPreview.value = ''
    deleteDialog.value = false
    await loadObjects()
  } catch (caught) {
    error.value = messageFromError(caught, 'Failed to delete S3 object.')
  } finally {
    deletingObject.value = false
  }
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function messageFromError(caught, fallback) {
  if (caught instanceof Error && caught.message) return caught.message
  return fallback
}

onMounted(loadBuckets)
</script>

<style scoped>
.service-console {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
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
.editor-actions,
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.toolbar {
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.toolbar :deep(.v-input) {
  flex: 1 1 260px;
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

.preview-panel {
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

  .panel-actions,
  .editor-actions {
    justify-content: stretch;
  }
}
</style>
