document.addEventListener('DOMContentLoaded', () => {
  const mainCalendarEl = document.getElementById('main-calendar');
  const formModal = document.getElementById('form-modal');
  const detailsModal = document.getElementById('details-modal');
  const eventForm = document.getElementById('event-form');
  let currentEventInfo = null; // Guarda informações do evento clicado

  // Função para formatar a data para os inputs datetime-local
  function toLocalISOString(date) {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, -1);
    return localISOTime.substring(0, 16);
  }

  // --- LÓGICA DO CALENDÁRIO PRINCIPAL ---
  const calendar = new FullCalendar.Calendar(mainCalendarEl, {
    initialView: 'dayGridMonth',
    locale: 'pt-br',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
    events: '/list-events',
    eventClick: function(info) {
      info.jsEvent.preventDefault();
      currentEventInfo = info.event;
      
      console.log('Event info:', currentEventInfo); // Debug log
      console.log('Extended props:', currentEventInfo.extendedProps); // Debug log
      
      // Populate event details
      document.getElementById('details-title').textContent = currentEventInfo.title;
      
      // Format date and time
      const start = new Date(currentEventInfo.start);
      const end = new Date(currentEventInfo.end);
      const dayName = start.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dateStr = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
      const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      document.getElementById('details-time').textContent = 
        `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr} • ${startTime} - ${endTime}`;
      
      // Handle attendees with status - access from extendedProps
      const attendees = currentEventInfo.extendedProps.attendees || [];
      console.log('Attendees:', attendees); // Debug log
      
      const attendeesRow = document.getElementById('attendees-row');
      const attendeesCount = document.getElementById('attendees-count');
      const attendeesList = document.getElementById('attendees-list');
      
      if (attendees.length > 0) {
        // Update count
        attendeesCount.textContent = `${attendees.length} convidado${attendees.length > 1 ? 's' : ''}`;
        
        // Clear and populate attendees list
        attendeesList.innerHTML = '';
        
        attendees.forEach((attendee) => {
          const email = attendee.email || attendee;
          const name = attendee.displayName || attendee.name || email.split('@')[0];
          const avatar = name.charAt(0).toUpperCase();
          const responseStatus = attendee.responseStatus || 'needsAction';
          
          // Map Google Calendar response status to Portuguese
          const statusMap = {
            'accepted': { text: 'Confirmado', class: 'status-accepted' },
            'declined': { text: 'Recusou', class: 'status-declined' },
            'tentative': { text: 'Talvez', class: 'status-tentative' },
            'needsAction': { text: 'Pendente', class: 'status-pending' }
          };
          
          const status = statusMap[responseStatus] || statusMap['needsAction'];
          
          const attendeeItem = document.createElement('div');
          attendeeItem.className = 'attendee-item';
          attendeeItem.innerHTML = `
            <div class="attendee-avatar">${avatar}</div>
            <div class="attendee-details">
              <div class="attendee-name">${name}</div>
              <div class="attendee-email">${email}</div>
            </div>
            <div class="attendee-status ${status.class}">
              <div class="status-indicator"></div>
              <span class="status-text">${status.text}</span>
            </div>
          `;
          attendeesList.appendChild(attendeeItem);
        });
        
        attendeesRow.style.display = 'flex';
      } else {
        attendeesRow.style.display = 'none';
      }
      
      // Handle Meet link - check multiple possible sources
      const meetLink = currentEventInfo.extendedProps.meetLink || 
                      currentEventInfo.extendedProps.hangoutLink || 
                      '';
      const meetRow = document.getElementById('meet-row');
      const meetLinkEl = document.getElementById('meet-link');
      
      if (meetLink) {
        meetLinkEl.href = meetLink;
        meetRow.style.display = 'flex';
      } else {
        meetRow.style.display = 'none';
      }
      
      // Load meeting notes and update button status
      updateNotesButtonStatus(currentEventInfo.id);
      
      detailsModal.style.display = 'flex';
    }
  });
  calendar.render();

  // --- LÓGICA GERAL DOS MODAIS (FECHAR) ---
  document.querySelectorAll('.modal-overlay .close-button').forEach(button => {
    button.onclick = () => {
      button.closest('.modal-overlay').style.display = 'none';
    };
  });
  window.onclick = (event) => {
    if (event.target.classList.contains('modal-overlay')) {
      event.target.style.display = 'none';
    }
  };

  // --- LÓGICA DO FORMULÁRIO (CRIAR E EDITAR) ---
  document.getElementById('open-create-modal-btn').addEventListener('click', () => {
    eventForm.reset();
    document.getElementById('event-id').value = '';
    document.getElementById('form-title').textContent = 'Criar Evento';
    document.getElementById('save-button').textContent = 'Salvar';
    formModal.style.display = 'flex';
  });

  eventForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const eventId = document.getElementById('event-id').value;
    const isEditing = !!eventId;

    // Monta o objeto do evento a partir do formulário
    const eventDetails = {
      summary: document.getElementById('summary').value,
      description: document.getElementById('description').value,
      start: { dateTime: new Date(document.getElementById('start-time').value).toISOString() },
      end: { dateTime: new Date(document.getElementById('end-time').value).toISOString() },
      attendees: document.getElementById('attendees').value.split(',').filter(e => e).map(e => ({ email: e.trim() }))
    };

    const url = isEditing ? `/update-event/${eventId}` : '/create-event';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventDetails)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      calendar.refetchEvents();
      formModal.style.display = 'none';
    } catch (error) {
      alert(`Erro ao salvar evento: ${error.message}`);
    }
  });

  // --- LÓGICA DOS BOTÕES DO MODAL DE DETALHES ---
  document.getElementById('edit-event-btn').addEventListener('click', () => {
    if (!currentEventInfo) return;

    detailsModal.style.display = 'none';

    // Preenche o formulário com os dados do evento para edição
    document.getElementById('event-id').value = currentEventInfo.id;
    document.getElementById('summary').value = currentEventInfo.title;
    document.getElementById('description').value = currentEventInfo.extendedProps.description || '';
    document.getElementById('start-time').value = toLocalISOString(currentEventInfo.start);
    document.getElementById('end-time').value = toLocalISOString(currentEventInfo.end);
    
    // Populate attendees field
    const attendees = currentEventInfo.extendedProps.attendees || [];
    const attendeesEmails = attendees.map(a => a.email || a).join(', ');
    document.getElementById('attendees').value = attendeesEmails;

    document.getElementById('form-title').textContent = 'Editar Evento';
    document.getElementById('save-button').textContent = 'Salvar Alterações';
    formModal.style.display = 'flex';
  });

  // Update close button functionality for new modal
  document.getElementById('close-btn').addEventListener('click', () => {
    detailsModal.style.display = 'none';
  });

  // Update delete button functionality  
  document.getElementById('delete-event-btn').addEventListener('click', async () => {
    if (!currentEventInfo || !confirm(`Tem certeza que deseja excluir o evento "${currentEventInfo.title}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/delete-event/${currentEventInfo.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      
      calendar.refetchEvents();
      detailsModal.style.display = 'none';
    } catch (error) {
      alert(`Erro ao excluir evento: ${error.message}`);
    }
  });

  // Notes Management Functions
  function getMeetingNotes(eventId) {
    const notes = localStorage.getItem(`meeting-notes-${eventId}`);
    return notes ? JSON.parse(notes) : null;
  }

  function saveMeetingNotes(eventId, content) {
    const noteData = {
      content: content,
      lastModified: new Date().toISOString(),
      eventId: eventId
    };
    
    // Save current version
    localStorage.setItem(`meeting-notes-${eventId}`, JSON.stringify(noteData));
    
    // Update history
    updateNotesHistory(eventId, 'Ata salva');
    
    return noteData;
  }

  function updateNotesHistory(eventId, action) {
    const historyKey = `notes-history-${eventId}`;
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    history.unshift({
      action: action,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    localStorage.setItem(historyKey, JSON.stringify(history));
  }

  function updateNotesButtonStatus(eventId) {
    const notesBtn = document.getElementById('open-notes-btn');
    const notesStatus = document.getElementById('notes-status');
    const noteData = getMeetingNotes(eventId);
    
    if (noteData && noteData.content.trim()) {
      notesBtn.classList.add('has-notes');
      notesStatus.textContent = 'Ver/editar anotações';
    } else {
      notesBtn.classList.remove('has-notes');
      notesStatus.textContent = 'Adicionar anotações';
    }
  }

  function updateWordCount() {
    const textarea = document.getElementById('meeting-minutes');
    const content = textarea.value;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    
    document.getElementById('word-count').textContent = `${words} palavra${words !== 1 ? 's' : ''}`;
    document.getElementById('char-count').textContent = `${chars} caractere${chars !== 1 ? 's' : ''}`;
  }

  function loadNotesHistory(eventId) {
    const historyKey = `notes-history-${eventId}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const historyList = document.getElementById('notes-history-list');
    
    if (history.length === 0) {
      historyList.innerHTML = '<p style="color: #5f6368; font-size: 13px; margin: 0;">Nenhuma modificação registrada</p>';
      return;
    }
    
    historyList.innerHTML = history.map(item => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString('pt-BR');
      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="history-item">
          <div class="history-item-info">
            <div class="history-item-action">${item.action}</div>
            <div class="history-item-time">${dateStr} às ${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Remove all participants modal related functions
  // Remove: updateParticipantsButtonStatus, loadParticipantsList, participants modal event listeners

  // Notes Modal Event Listeners
  document.getElementById('open-notes-btn').addEventListener('click', () => {
    if (!currentEventInfo) return;
    
    const notesModal = document.getElementById('notes-modal');
    const textarea = document.getElementById('meeting-minutes');
    
    // Update modal header info
    document.getElementById('notes-modal-title').textContent = `Ata da Reunião - ${currentEventInfo.title}`;
    document.getElementById('notes-event-title').textContent = currentEventInfo.title;
    
    const start = new Date(currentEventInfo.start);
    const dateStr = start.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('notes-event-date').textContent = `${dateStr} às ${timeStr}`;
    
    // Load existing notes
    const noteData = getMeetingNotes(currentEventInfo.id);
    textarea.value = noteData ? noteData.content : '';
    
    // Update word count
    updateWordCount();
    
    // Load history
    loadNotesHistory(currentEventInfo.id);
    
    notesModal.style.display = 'flex';
  });

  // Close notes modal
  document.querySelector('.notes-close-btn').addEventListener('click', () => {
    document.getElementById('notes-modal').style.display = 'none';
  });

  // Back button from notes modal
  document.getElementById('back-from-notes-btn').addEventListener('click', () => {
    document.getElementById('notes-modal').style.display = 'none';
    detailsModal.style.display = 'flex';
  });

  // Save meeting minutes
  document.getElementById('save-minutes-btn').addEventListener('click', () => {
    if (!currentEventInfo) return;
    
    const textarea = document.getElementById('meeting-minutes');
    const content = textarea.value.trim();
    const saveBtn = document.getElementById('save-minutes-btn');
    
    // Visual feedback
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Salvo!
    `;
    saveBtn.classList.add('saving');
    saveBtn.disabled = true;
    
    // Save notes
    saveMeetingNotes(currentEventInfo.id, content);
    
    // Update button status in main modal
    updateNotesButtonStatus(currentEventInfo.id);
    
    // Reload history
    loadNotesHistory(currentEventInfo.id);
    
    setTimeout(() => {
      saveBtn.innerHTML = originalHTML;
      saveBtn.classList.remove('saving');
      saveBtn.disabled = false;
    }, 2000);
  });

  // Clear notes
  document.getElementById('clear-notes-btn').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todas as anotações? Esta ação não pode ser desfeita.')) {
      document.getElementById('meeting-minutes').value = '';
      updateWordCount();
    }
  });

  // Update word count on typing
  document.getElementById('meeting-minutes').addEventListener('input', updateWordCount);

  // Auto-save on blur
  document.getElementById('meeting-minutes').addEventListener('blur', () => {
    if (!currentEventInfo) return;
    
    const content = document.getElementById('meeting-minutes').value.trim();
    if (content) {
      saveMeetingNotes(currentEventInfo.id, content);
      updateNotesButtonStatus(currentEventInfo.id);
      updateNotesHistory(currentEventInfo.id, 'Auto-save');
    }
  });
});