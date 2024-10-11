// script.js
document.addEventListener('DOMContentLoaded', () => {
    const formFields = document.querySelectorAll('.form-field');
    
    formFields.forEach(field => {
        const input = field.querySelector('input');
        if (!input.value) {
            field.style.display = 'block';
        }
    });
});

function submitForm() {
    const form = document.getElementById('dynamicForm');
    form.submit();
    alert('Form submitted!');
}

function cancelForm() {
    const formFields = document.querySelectorAll('.form-field');
    formFields.forEach(field => {
        field.style.display = 'none';
    });
    alert('Form canceled!');
}
