export default {
  name: 'ThemenbereichSelect',
  props: {
    modelValue: { type: String, default: '' },
    themenbereiche: { type: Array, required: true },
  },
  emits: ['update:modelValue'],
  template: `
    <select :value="modelValue" :class="$attrs.class ? '' : 'input'" @change="$emit('update:modelValue', $event.target.value)">
      <option value="">{{ $attrs.class ? 'Themenbereich' : '– Themenbereich –' }}</option>
      <option v-for="tb in themenbereiche" :key="tb.id" :value="tb.id">{{ tb.name }}</option>
    </select>
  `,
}
