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
      
      // Handle attendees
      const attendees = currentEventInfo.extendedProps.attendees || [];
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
          
          const attendeeItem = document.createElement('div');
          attendeeItem.className = 'attendee-item';
          attendeeItem.innerHTML = `
            <div class="attendee-avatar">${avatar}</div>
            <div class="attendee-details">
              <div class="attendee-name">${name}</div>
              <div class="attendee-email">${email}</div>
            </div>
          `;
          attendeesList.appendChild(attendeeItem);
        });
        
        attendeesRow.style.display = 'flex';
      } else {
        attendeesRow.style.display = 'none';
      }
      
      // Handle Meet link
      const meetLink = currentEventInfo.extendedProps.meetLink || currentEventInfo.extendedProps.hangoutLink || '';
      const meetRow = document.getElementById('meet-row');
      const meetLinkEl = document.getElementById('meet-link');
      
      if (meetLink) {
        meetLinkEl.href = meetLink;
        meetRow.style.display = 'flex';
      } else {
        meetRow.style.display = 'none';
      }
      
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
});