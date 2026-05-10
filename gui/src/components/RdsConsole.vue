<template>
  <div class="rds-console">
    <div class="console-header">
      <div>
        <h2 class="text-h6">RDS</h2>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Floci RDS clusters backed by local PostgreSQL containers.
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="loadRds">
        Refresh
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="comfortable">
      {{ error }}
    </v-alert>

    <v-row align="stretch">
      <v-col cols="12" lg="7">
        <v-sheet border rounded="lg" class="h-100">
          <div class="section-header">
            <h3 class="text-subtitle-1">Clusters</h3>
            <v-chip size="small" variant="tonal">{{ clusters.length }}</v-chip>
          </div>

          <v-table>
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Engine</th>
                <th>Status</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!loading && clusters.length === 0">
                <td colspan="4" class="text-medium-emphasis">No RDS clusters found.</td>
              </tr>
              <tr
                v-for="cluster in clusters"
                :key="cluster.DBClusterIdentifier"
                :class="{ selected: selectedClusterId === cluster.DBClusterIdentifier }"
                @click="selectedClusterId = cluster.DBClusterIdentifier"
              >
                <td class="identifier">{{ cluster.DBClusterIdentifier }}</td>
                <td>{{ cluster.Engine }}</td>
                <td>
                  <v-chip size="small" :color="statusColor(cluster.Status)" variant="tonal">
                    {{ cluster.Status || 'unknown' }}
                  </v-chip>
                </td>
                <td>{{ cluster.EngineVersion || '-' }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-sheet>
      </v-col>

      <v-col cols="12" lg="5">
        <v-sheet border rounded="lg" class="details h-100">
          <div class="section-header">
            <h3 class="text-subtitle-1">Connection</h3>
          </div>

          <div v-if="selectedCluster" class="detail-grid">
            <div class="detail-item">
              <span>Writer endpoint</span>
              <strong>{{ selectedCluster.Endpoint || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Reader endpoint</span>
              <strong>{{ selectedCluster.ReaderEndpoint || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Port</span>
              <strong>{{ selectedCluster.Port || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Database</span>
              <strong>{{ selectedCluster.DatabaseName || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Master user</span>
              <strong>{{ selectedCluster.MasterUsername || '-' }}</strong>
            </div>
            <div class="detail-item">
              <span>Multi-AZ</span>
              <strong>{{ selectedCluster.MultiAZ ? 'enabled' : 'disabled' }}</strong>
            </div>
          </div>

          <div v-else class="empty-detail text-medium-emphasis">
            Select a cluster to inspect its local connection metadata.
          </div>
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { listDbClusters } from '../aws/rds'

const clusters = ref([])
const error = ref('')
const loading = ref(false)
const selectedClusterId = ref('')

const selectedCluster = computed(
  () => clusters.value.find((cluster) => cluster.DBClusterIdentifier === selectedClusterId.value) || null,
)

function statusColor(status) {
  return status === 'available' ? 'success' : 'warning'
}

async function loadRds() {
  loading.value = true
  error.value = ''

  try {
    clusters.value = await listDbClusters()
    if (!selectedClusterId.value && clusters.value.length > 0) {
      selectedClusterId.value = clusters.value[0].DBClusterIdentifier
    }
    if (selectedClusterId.value && !selectedCluster.value) {
      selectedClusterId.value = clusters.value[0]?.DBClusterIdentifier || ''
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to load RDS clusters.'
  } finally {
    loading.value = false
  }
}

onMounted(loadRds)
</script>

<style scoped>
.rds-console {
  display: grid;
  gap: 16px;
}

.console-header,
.section-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.console-header {
  margin-bottom: 4px;
}

.section-header {
  padding: 16px;
}

tbody tr {
  cursor: pointer;
}

tbody tr.selected {
  background: rgba(var(--v-theme-primary), 0.08);
}

.identifier,
.detail-item strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.details {
  display: flex;
  flex-direction: column;
}

.detail-grid {
  display: grid;
  gap: 12px;
  padding: 0 16px 16px;
}

.detail-item {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: grid;
  gap: 4px;
  padding-top: 12px;
}

.detail-item span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}

.detail-item strong {
  overflow-wrap: anywhere;
}

.empty-detail {
  padding: 0 16px 16px;
}
</style>
