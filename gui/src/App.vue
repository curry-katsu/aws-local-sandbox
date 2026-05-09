<template>
  <v-app>
    <v-navigation-drawer permanent width="260">
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-cloud-outline"
          title="aws-local-sandbox"
          subtitle="Floci Console"
        />
        <v-divider class="my-2" />
        <v-list-item
          v-for="item in navigationItems"
          :key="item.value"
          :active="selectedView === item.value"
          :prepend-icon="item.icon"
          :title="item.title"
          @click="selectedView = item.value"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat border>
      <v-app-bar-title>{{ selectedNavigation.title }}</v-app-bar-title>
      <v-chip class="mr-4" color="secondary" variant="tonal" size="small">
        {{ endpointUrl }}
      </v-chip>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-6">
        <template v-if="selectedView === 'dashboard'">
          <v-row class="mb-4" align="stretch">
            <v-col cols="12" md="4">
              <v-sheet border rounded="lg" class="pa-4 h-100">
                <div class="text-caption text-medium-emphasis">Endpoint</div>
                <div class="text-body-1 font-weight-medium">{{ endpointUrl }}</div>
              </v-sheet>
            </v-col>
            <v-col cols="12" md="4">
              <v-sheet border rounded="lg" class="pa-4 h-100">
                <div class="text-caption text-medium-emphasis">Region</div>
                <div class="text-body-1 font-weight-medium">{{ region }}</div>
              </v-sheet>
            </v-col>
            <v-col cols="12" md="4">
              <v-sheet border rounded="lg" class="pa-4 h-100">
                <div class="text-caption text-medium-emphasis">Credentials</div>
                <div class="text-body-1 font-weight-medium">dummy local keys</div>
              </v-sheet>
            </v-col>
          </v-row>

          <ResourceList />
        </template>

        <DynamoDbConsole v-else-if="selectedView === 'dynamodb'" />
        <S3Console v-else-if="selectedView === 's3'" />
        <SqsConsole v-else-if="selectedView === 'sqs'" />
        <SnsConsole v-else-if="selectedView === 'sns'" />
        <CognitoLoginVerifier v-else-if="selectedView === 'cognito'" />
        <EventBridgeVerifier v-else-if="selectedView === 'eventbridge'" />
        <StepFunctionsVerifier v-else-if="selectedView === 'stepfunctions'" />
        <v-sheet v-else border rounded="lg" class="service-placeholder">
          <v-icon :icon="selectedNavigation.icon" size="36" />
          <div>
            <h2 class="text-h6">{{ selectedNavigation.title }}</h2>
            <p class="text-body-2 text-medium-emphasis ma-0">
              This service console is ready for a dedicated tuning view.
            </p>
          </div>
        </v-sheet>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, ref } from 'vue'
import CognitoLoginVerifier from './components/CognitoLoginVerifier.vue'
import DynamoDbConsole from './components/DynamoDbConsole.vue'
import EventBridgeVerifier from './components/EventBridgeVerifier.vue'
import ResourceList from './components/ResourceList.vue'
import S3Console from './components/S3Console.vue'
import SnsConsole from './components/SnsConsole.vue'
import SqsConsole from './components/SqsConsole.vue'
import StepFunctionsVerifier from './components/StepFunctionsVerifier.vue'

const endpointUrl = import.meta.env.VITE_AWS_BROWSER_ENDPOINT_URL || `${window.location.origin}/floci`
const region = import.meta.env.VITE_AWS_REGION || 'us-east-1'

const navigationItems = [
  { value: 'dashboard', title: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
  { value: 's3', title: 'S3', icon: 'mdi-bucket-outline' },
  { value: 'dynamodb', title: 'DynamoDB', icon: 'mdi-database-outline' },
  { value: 'sqs', title: 'SQS', icon: 'mdi-message-outline' },
  { value: 'sns', title: 'SNS', icon: 'mdi-bullhorn-outline' },
  { value: 'cognito', title: 'Cognito', icon: 'mdi-account-key-outline' },
  { value: 'eventbridge', title: 'EventBridge', icon: 'mdi-calendar-clock-outline' },
  { value: 'stepfunctions', title: 'Step Functions', icon: 'mdi-transit-connection-variant' },
]

const selectedView = ref('dashboard')
const selectedNavigation = computed(
  () => navigationItems.find((item) => item.value === selectedView.value) || navigationItems[0],
)
</script>

<style scoped>
.service-placeholder {
  align-items: center;
  display: flex;
  gap: 16px;
  padding: 24px;
}
</style>
