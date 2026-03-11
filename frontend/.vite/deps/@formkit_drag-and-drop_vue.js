import {
  dragAndDrop,
  isBrowser,
  tearDown
} from "./chunk-MOA6RKH5.js";
import {
  onUnmounted,
  ref,
  watch
} from "./chunk-LFWDD2CS.js";
import "./chunk-UP2VWCW5.js";

// node_modules/@formkit/drag-and-drop/vue/index.mjs
function getEl(parent) {
  if (parent instanceof HTMLElement)
    return parent;
  else if (parent.value instanceof HTMLElement)
    return parent.value;
  else if ("$el" in parent && parent.$el instanceof HTMLElement)
    return parent.$el;
}
function handleVueElements(elements, cb) {
  if (!Array.isArray(elements))
    elements = [elements];
  for (const element of elements) {
    const validEl = getEl(element);
    if (validEl)
      return cb(validEl);
    const stop = watch(element, (newEl) => {
      if (!newEl)
        return;
      const validEl2 = getEl(newEl);
      !validEl2 ? console.warn("Invalid parent element", newEl) : cb(validEl2);
      stop();
    });
  }
}
var parentValues = /* @__PURE__ */ new WeakMap();
function getValues(parent) {
  const values = parentValues.get(parent);
  if (!values) {
    console.warn("No values found for parent element");
    return [];
  }
  return values.value;
}
function setValues(newValues, parent) {
  const currentValues = parentValues.get(parent);
  if (currentValues)
    currentValues.value = newValues;
}
function dragAndDrop2(data) {
  if (!isBrowser)
    return;
  if (!Array.isArray(data))
    data = [data];
  data.forEach((dnd) => {
    const { parent, values, ...rest } = dnd;
    handleVueElements(parent, handleParent(rest, values));
  });
}
function useDragAndDrop(initialValues, options = {}) {
  const parent = ref();
  const values = ref(initialValues);
  function updateConfig(config = {}) {
    dragAndDrop2({ parent, values, ...config });
  }
  dragAndDrop2({ parent, values, ...options });
  onUnmounted(() => parent.value && tearDown(parent.value));
  return [parent, values, updateConfig];
}
function handleParent(config, values) {
  return (parent) => {
    parentValues.set(parent, values);
    dragAndDrop({
      parent,
      getValues,
      setValues,
      config: {
        ...config,
        dropZones: []
      }
    });
  };
}
export {
  dragAndDrop2 as dragAndDrop,
  useDragAndDrop
};
//# sourceMappingURL=@formkit_drag-and-drop_vue.js.map
