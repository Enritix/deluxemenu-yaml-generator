// app.js
import { loadItems } from "./items.js";

let items = [];
let configuredItems = Array(9).fill(null);
let itemDetails = Array(9).fill({}); // For storing per-slot item info

const MC_COLORS = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
};
const MC_FORMATS = {
  'l': 'class="minecraft-bold"',   // Bold
  'm': 'text-decoration:line-through;', // Strikethrough
  'n': 'text-decoration:underline;',    // Underline
  'o': 'font-style:italic;', // Italic
  'r': 'reset' // Reset formatting
};

// --- DOM Elements ---
const itemGrid = document.getElementById('item-grid');
const menuTitleInput = document.getElementById('menu-title');
const openCommandInput = document.getElementById('open-command');
const registerCommandInput = document.getElementById('register-command');
const updateIntervalInput = document.getElementById('update-interval');
const openCommandsInput = document.getElementById('open-commands');

// const menuSizeInput = document.getElementById('menu-size');
const yamlOutput = document.getElementById('yaml-output');
const downloadBtn = document.getElementById('download-btn');

const itemFields = [
  // Basic
  "material", "amount", "data", "slot", "slots", "priority", "update", "dynamic_amount",
  "display_name", "lore", "enchantments", "item_flags", "potion_effects", "entity_type",
  "custom_model_data", "unbreakable", "hide_enchantments", "hide_attributes",
  "hide_effects", "hide_unbreakable", "base_color", "banner_meta", "player_head",
  "skull_owner", "model_data", "rgb", "nbt_string", "nbt_int", "nbt",

  // Requirements
  "view_requirement", "left_click_requirement", "right_click_requirement",
  "middle_click_requirement", "shift_left_click_requirement", "shift_right_click_requirement",
  "slot_requirement", "requirement_list",

  // Commands/Actions
  "click_commands", "left_click_commands", "right_click_commands", "middle_click_commands",
  "shift_left_click_commands", "shift_right_click_commands", "actions",

  // Slot-specific
  "slot_update", "slot_priority",

  // Refresh/Update
  "refresh_commands", "refresh_interval", "view_update", "item_update"
];


const itemInputs = Object.fromEntries(itemFields.map(f => [f, document.getElementById('item-' + f)]));


let selectedSlot = 0; // = currently selected slot for editing item info

// --- Render Item Grid ---
function renderItemGrid() {
  itemGrid.innerHTML = '';
  const slotsPerRow = 9;
  for (let row = 0; row < Math.ceil(configuredItems.length / slotsPerRow); row++) {
    const rowDiv = document.createElement('div');
    rowDiv.style.display = 'flex';
    for (let col = 0; col < slotsPerRow; col++) {
      const i = row * slotsPerRow + col;
      if (i >= configuredItems.length) break;
      const slot = document.createElement('div');
      slot.className = 'item-slot';
      slot.style.position = 'relative';
      if (i === selectedSlot) slot.classList.add('selected');

      const details = itemDetails[i] || {};
      const material = (details.material || (configuredItems[i] && configuredItems[i].material) || '').toUpperCase();

      if (configuredItems[i] || details.material) {
        const img = document.createElement('img');

        if (material === "PLAYER_HEAD") {
          if (details.skull_owner) {
            img.src = `https://visage.surgeplay.com/head/32/${encodeURIComponent(details.skull_owner)}`;
            img.alt = details.skull_owner;
            img.title = details.skull_owner + "'s Head";
            img.classList.add('flip-head');
          } else {
            // Default Steve hoofd
            img.src = "https://minecraft-api.vercel.app/images/items/player_head.png";
            img.alt = "Player Head";
            img.title = "Player Head";
          }
        } else if (configuredItems[i]) {
          img.src = configuredItems[i].icon;
          img.alt = configuredItems[i].name;
          img.title = configuredItems[i].name;
        } else {
          // Geen item: toon een barrier of leeg slot
          img.src = "https://minecraft-api.vercel.app/images/items/barrier.png";
          img.alt = "No item";
          img.title = "No item";
        }
        slot.appendChild(img);

        const amount = details.amount ? parseInt(details.amount, 10) : 1;
        if (amount > 1) {
          const amountDiv = document.createElement('div');
          amountDiv.className = 'item-amount-overlay';
          amountDiv.textContent = amount;
          slot.appendChild(amountDiv);
        }
      }

      slot.onclick = () => {
        selectedSlot = i;
        renderItemGrid();
        loadItemInfoFields(i);
      };
      slot.ondblclick = () => openItemPicker(i);
      rowDiv.appendChild(slot);
    }
    itemGrid.appendChild(rowDiv);
  }
}


const amountInput = document.getElementById('item-amount');
amountInput.min = 1;
amountInput.max = 64;

amountInput.oninput = function () {
  let val = parseInt(amountInput.value, 10);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 64) val = 64;
  amountInput.value = val;

  if (!itemDetails[selectedSlot]) itemDetails[selectedSlot] = {};
  itemDetails[selectedSlot].amount = val;

  generateYAML();
  renderItemGrid();
};



function minecraftCodesToHtml(str) {
  let result = '';
  let openTags = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '&' && i + 1 < str.length) {
      const code = str[i + 1].toLowerCase();
      i += 2;
      if (MC_COLORS[code]) {
        while (openTags.length) result += '</span>', openTags.pop();
        result += `<span style="color:${MC_COLORS[code]};">`;
        openTags.push('color');
      } else if (MC_FORMATS[code]) {
        if (code === 'r') {
          while (openTags.length) result += '</span>', openTags.pop();
        } else if (code === 'l') {
          result += `<span class="minecraft-bold">`;
          openTags.push('format');
        } else {
          result += `<span style="${MC_FORMATS[code]}">`;
          openTags.push('format');
        }
      }
    } else {
      // Escape HTML
      if (str[i] === '<') result += '&lt;';
      else if (str[i] === '>') result += '&gt;';
      else if (str[i] === '&') result += '&amp;';
      else result += str[i];
      i++;
    }
  }
  while (openTags.length) result += '</span>', openTags.pop();
  return result;
}

function updateRenderedTitle() {
  const renderedTitleDiv = document.getElementById('rendered-title');
  renderedTitleDiv.innerHTML = minecraftCodesToHtml(menuTitleInput.value || '');
}


// --- Load Item Info Fields for Selected Slot ---
function loadItemInfoFields(slotIdx) {
  const info = itemDetails[slotIdx] || {};
  amountInput.value = info.amount || 1;
  for (const key of itemFields) {
    itemInputs[key].value = info[key] || '';
  }
}

// --- Save Item Info Fields for Selected Slot ---
function saveItemInfoFields(slotIdx) {
  const info = {};
  for (const key of itemFields) {
    if (itemInputs[key].value) info[key] = itemInputs[key].value;
  }
  itemDetails[slotIdx] = info;
}

// --- Item Picker Dialog ---
function openItemPicker(slotIndex) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.onclick = e => { if (e.target === overlay) document.body.removeChild(overlay); };

  const picker = document.createElement('div');
  picker.className = 'picker-panel';
  picker.onclick = e => e.stopPropagation();

  const searchBox = document.createElement('input');
  searchBox.type = 'text';
  searchBox.placeholder = 'Search items';
  picker.appendChild(searchBox);

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'picker-items';

  function renderItems(filter = '') {
    itemsContainer.innerHTML = '';
    items.forEach(item => {
      if (filter && !item.name.toLowerCase().includes(filter.toLowerCase())) return;
      const btn = document.createElement('button');
      btn.title = item.name;
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      btn.appendChild(img);
      btn.onclick = () => {
        configuredItems[slotIndex] = {
          name: item.name,
          material: item.namespacedId.replace('minecraft:', '').toUpperCase(),
          icon: item.image
        };
        renderItemGrid();
        document.body.removeChild(overlay);
        generateYAML();
      };
      itemsContainer.appendChild(btn);
    });
  }

  searchBox.oninput = () => renderItems(searchBox.value);
  renderItems();

  picker.appendChild(itemsContainer);
  overlay.appendChild(picker);
  document.body.appendChild(overlay);
}

// --- YAML Generation ---
function generateYAML() {
  saveItemInfoFields(selectedSlot);

  const menuTitle = menuTitleInput.value;
  const openCommand = openCommandInput.value;
  const registerCommand = registerCommandInput ? registerCommandInput.value : "true";
  const updateInterval = updateIntervalInput ? updateIntervalInput.value : "";
  const openCommands = openCommandsInput ? openCommandsInput.value : "";

  let yaml = "";

  if (menuTitle) yaml += `menu_title: '${menuTitle}'\n`;
  if (openCommand) yaml += `open_command: ${openCommand}\n`;
  yaml += `register_command: ${registerCommand}\n`; // always present
  if (updateInterval) yaml += `update_interval: ${updateInterval}\n`;
  if (openCommands.trim()) {
    yaml += "open_commands:\n";
    openCommands.split('\n').forEach(line => {
      if (line.trim()) yaml += `  ${line.trim().startsWith('-') ? line.trim() : '- ' + line.trim()}\n`;
    });
  }

  yaml += `size: ${configuredItems.length}\nitems:\n`;

  configuredItems.forEach((item, idx) => {
    if (item) {
      yaml += `  '${idx}':\n    material: ${item.material}\n    slot: ${idx}\n`;
      const info = itemDetails[idx] || {};
      for (const key of itemFields) {
        if (info[key]) yaml += `    ${key}: ${info[key]}\n`;
      }
    }
  });

  yamlOutput.textContent = yaml;
}



// --- Download YAML ---
downloadBtn.onclick = function () {
  const blob = new Blob([yamlOutput.textContent], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "deluxemenu.yml";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

// --- Button Actions ---
document.getElementById('clear-btn').onclick = function () {
  configuredItems = Array(configuredItems.length).fill(null);
  itemDetails = Array(configuredItems.length).fill({});
  renderItemGrid();
  generateYAML();
};
document.getElementById('clear-slot-btn').onclick = function () {
  configuredItems[selectedSlot] = null;
  itemDetails[selectedSlot] = {};
  renderItemGrid();
  generateYAML();
};
document.getElementById('add-row-btn').onclick = function () {
  const maxSlots = 54;
  if (configuredItems.length + 9 <= maxSlots) {
    for (let i = 0; i < 9; i++) {
      configuredItems.push(null);
      itemDetails.push({});
    }
    renderItemGrid();
    generateYAML();
  }
};
document.getElementById('remove-row-btn').onclick = function () {
  if (configuredItems.length > 9) {
    for (let i = 0; i < 9; i++) {
      configuredItems.pop();
      itemDetails.pop();
    }
    selectedSlot = Math.min(selectedSlot, configuredItems.length - 1);
    // menuSizeInput.value = configuredItems.length;
    renderItemGrid();
    generateYAML();
  }
};

let extraShown = false;
const hideExtraBtn = document.getElementById('hide-extra-btn');
hideExtraBtn.onclick = function () {
  extraShown = !extraShown;
  document.querySelectorAll('.extra-item-info').forEach(el => {
    el.style.display = extraShown ? '' : 'none';
  });
  hideExtraBtn.textContent = extraShown ? 'Hide extra' : 'Show extra';
};
document.querySelectorAll('.extra-item-info').forEach(el => {
  el.style.display = 'none';
});
hideExtraBtn.textContent = 'Show extra';


registerCommandInput.oninput = generateYAML;
updateIntervalInput.oninput = generateYAML;
openCommandsInput.oninput = generateYAML;


// --- Update YAML on menu info or item info change ---
menuTitleInput.oninput = function () {
  generateYAML();
  updateRenderedTitle();
};
openCommandInput.oninput = generateYAML;
// menuSizeInput.oninput = function() {
//   const size = parseInt(menuSizeInput.value, 10);
//   if (size > configuredItems.length) {
//     while (configuredItems.length < size) {
//       configuredItems.push(null);
//       itemDetails.push({});
//     }
//   } else if (size < configuredItems.length) {
//     configuredItems = configuredItems.slice(0, size);
//     itemDetails = itemDetails.slice(0, size);
//     selectedSlot = Math.min(selectedSlot, size - 1);
//   }
//   renderItemGrid();
//   generateYAML();
// };
for (const key of itemFields) {
  if (key === "amount") continue; // skip amount here!
  if (itemInputs[key]) {
    itemInputs[key].oninput = () => {
      saveItemInfoFields(selectedSlot);
      generateYAML();
    };
  }
}

const toggleBtn = document.getElementById('toggle-mode-btn');
let showRequirements = false;

function updateToggleVisibility() {
  const guiFields = document.querySelectorAll('.gui-field');
  const reqFields = document.querySelectorAll('.requirements-field');

  if (showRequirements) {
    guiFields.forEach(el => el.classList.add('hide'));
    reqFields.forEach(el => el.classList.remove('hide'));
    toggleBtn.textContent = "Show GUI";
  } else {
    guiFields.forEach(el => el.classList.remove('hide'));
    reqFields.forEach(el => el.classList.add('hide'));
    toggleBtn.textContent = "Show Requirements";
  }
}

// Zet standaard op GUI
updateToggleVisibility();

toggleBtn.onclick = function() {
  showRequirements = !showRequirements;
  updateToggleVisibility();
};




// --- Initial Load ---
async function init() {
  items = await loadItems();
  renderItemGrid();
  loadItemInfoFields(selectedSlot);
  generateYAML();
  updateRenderedTitle();
}
init();
