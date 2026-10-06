import webpush from 'web-push';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
if(existsSync('.dev.vars')){console.error('.dev.vars already exists; refusing to overwrite keys.');process.exit(1);}
const rl=createInterface({input:process.stdin,output:process.stdout});
console.log('Generate keys locally. Your password will be visible while you type.');
const password=await rl.question('Choose a strong app password (at least 12 characters): ');
const email=await rl.question('Email for push service contact: ');rl.close();
if(password.length<12||!/^\S+@\S+\.\S+$/.test(email)){console.error('Use a 12+ character password and valid email.');process.exit(1);}
const salt=randomBytes(16).toString('hex');
const hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
const keys=webpush.generateVAPIDKeys();
writeFileSync('.dev.vars',`PASSWORD_HASH="${salt}:${hash}"\nVAPID_PUBLIC_KEY="${keys.publicKey}"\nVAPID_PRIVATE_KEY="${keys.privateKey}"\nVAPID_SUBJECT="mailto:${email}"\n`,{mode:0o600});
console.log('Wrote .dev.vars (gitignored). Keep it private; never commit it.');
