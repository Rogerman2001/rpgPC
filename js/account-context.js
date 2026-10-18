let account=null;
export function setAccount(value){account=value;}
export function getAccount(){if(!account)throw Error('Debes iniciar sesión antes de jugar.');return account;}
