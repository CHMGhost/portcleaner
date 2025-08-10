// Sample command outputs for testing
module.exports = {
  mac: {
    lsofNormal: `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345   user   23u  IPv4 0x123456789abcdef      0t0  TCP *:3000 (LISTEN)
postgres  23456   user    7u  IPv4 0xabcdef123456789      0t0  TCP *:5432 (LISTEN)
mysqld    34567   user   21u  IPv4 0xfedcba987654321      0t0  TCP *:3306 (LISTEN)
redis-ser 45678   user    6u  IPv4 0x111111111111111      0t0  TCP localhost:6379 (LISTEN)
Docker    56789   user   44u  IPv4 0x222222222222222      0t0  TCP *:8080 (LISTEN)
mongod    67890   user   12u  IPv4 0x333333333333333      0t0  TCP *:27017 (LISTEN)`,
    
    lsofEmpty: '',
    
    lsofMalformed: `COMMAND PID USER
node 12345
invalid output format
ERROR: Something went wrong`,
    
    lsofLargePorts: `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
app1      11111   user   23u  IPv4 0x123456789abcdef      0t0  TCP *:80 (LISTEN)
app2      22222   user   24u  IPv4 0x123456789abcdef      0t0  TCP *:443 (LISTEN)
app3      33333   user   25u  IPv4 0x123456789abcdef      0t0  TCP *:8080 (LISTEN)
app4      44444   user   26u  IPv4 0x123456789abcdef      0t0  TCP *:65535 (LISTEN)
app5      55555   user   27u  IPv6 0x123456789abcdef      0t0  TCP *:9000 (LISTEN)`,

    psInfo: `  PID   %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND
12345  15.2  2.5  5123456 262144   ??  S    10:30AM   1:23.45 node
23456   3.1  5.2  8234567 543210   ??  S     9:15AM   5:43.21 postgres
34567   1.2  3.8  6345678 397312   ??  S     8:00AM   3:21.10 mysqld`,

    killSuccess: '',
    killPermissionDenied: 'kill: kill 12345 failed: operation not permitted',
    killNoProcess: 'kill: kill 99999 failed: no such process'
  },
  
  windows: {
    netstatNormal: `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:80            0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:135           0.0.0.0:0              LISTENING       880
  TCP    0.0.0.0:445           0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:3000          0.0.0.0:0              LISTENING       12345
  TCP    0.0.0.0:3306          0.0.0.0:0              LISTENING       23456
  TCP    0.0.0.0:5432          0.0.0.0:0              LISTENING       34567
  TCP    127.0.0.1:6379        0.0.0.0:0              LISTENING       45678
  TCP    [::]:80               [::]:0                 LISTENING       4
  TCP    [::]:443              [::]:0                 LISTENING       4
  UDP    0.0.0.0:123           *:*                                    1092`,
    
    netstatEmpty: '\nActive Connections\n\n',
    
    netstatMalformed: `
Active Connections
Invalid format here
ERROR STATUS`,

    tasklistInfo: `
Image Name                     PID Session Name        Mem Usage
========================= ======== ================ ============
System Idle Process              0 Services                  8 K
System                           4 Services                152 K
node.exe                     12345 Console                52,432 K
postgres.exe                 23456 Services              102,344 K
mysqld.exe                   34567 Services               89,456 K`,

    taskkillSuccess: 'SUCCESS: The process with PID 12345 has been terminated.',
    taskkillAccessDenied: 'ERROR: The process with PID "12345" could not be terminated.\nReason: Access is denied.',
    taskkillNotFound: 'ERROR: The process "99999" not found.'
  },
  
  // Multi-platform edge cases
  edgeCases: {
    veryHighPort: `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
app       99999   user   23u  IPv4 0x123456789abcdef      0t0  TCP *:65535 (LISTEN)`,
    
    mixedProtocols: `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
app1      11111   user   23u  IPv4 0x123456789abcdef      0t0  TCP *:8080 (LISTEN)
app2      22222   user   24u  IPv4 0x123456789abcdef      0t0  UDP *:8081
app3      33333   user   25u  IPv6 0x123456789abcdef      0t0  TCP *:8082 (LISTEN)`,
    
    specialCharacters: `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
my-app    11111   user   23u  IPv4 0x123456789abcdef      0t0  TCP *:3000 (LISTEN)
app_2.0   22222   user   24u  IPv4 0x123456789abcdef      0t0  TCP *:3001 (LISTEN)
app@prod  33333   user   25u  IPv4 0x123456789abcdef      0t0  TCP *:3002 (LISTEN)`
  }
};