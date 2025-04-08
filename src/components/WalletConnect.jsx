// import { useEffect } from 'react';
// import { ConnectButton } from '@rainbow-me/rainbowkit';
// import { useAccount, useSwitchChain, useChainId } from 'wagmi';
// import { useMentoraContract } from '../hooks/useMentoraContract';

// const WalletConnect = ({ onConnect }) => {
//   const { address, isConnected } = useAccount();
//   const chainId = useChainId();
//   const { switchChain } = useSwitchChain();
//   const { initialize, error: clientError } = useMentoraContract();

//   // Open Campus Codex Network ID
//   const OPENCAMPUS_CHAIN_ID = 656476; // Open Campus Codex chain ID

//   useEffect(() => {
//     if (isConnected && address) {
//       // Notify parent component when wallet connects
//       if (onConnect) onConnect(address);
      
//       // Initialize your contract if needed
//       initialize?.();
//     }
//   }, [address, isConnected, onConnect, initialize]);

//   const handleSwitchToOpenCampus = () => {
//     if (switchChain) {
//       switchChain({ chainId: OPENCAMPUS_CHAIN_ID });
//     }
//   };

//   const isOpenCampusNetwork = chainId === OPENCAMPUS_CHAIN_ID;

//   return (
//     <div className="flex items-center flex-wrap gap-4">
//       {/* RainbowKit's ConnectButton handles wallet connection UI */}
//       <ConnectButton showBalance={false} />
      
//       {/* Show switch network button if connected but not on Open Campus */}
//       {isConnected && !isOpenCampusNetwork && (
//         <button
//           onClick={handleSwitchToOpenCampus}
//           className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200"
//         >
//           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
//             <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
//           </svg>
//           <span>Switch to Open Campus</span>
//         </button>
//       )}
      
//       {/* Show network indicator if on Open Campus */}
//       {isConnected && isOpenCampusNetwork && (
//         <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full flex items-center gap-2">
//           <span>✓ Open Campus Network</span>
//         </div>
//       )}
      
//       {/* Display contract errors if any */}
//       {clientError && (
//         <div className="text-red-500 text-sm">
//           Client error: {clientError}
//         </div>
//       )}
//     </div>
//   );
// };

// export default WalletConnect;

import { useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSwitchChain, useChainId } from 'wagmi';
import { useMentoraContract } from '../hooks/useMentoraContract';

// Network configurations
const NETWORKS = {
  OPENCAMPUS: {
    id: 656476,
    name: 'Open Campus Codex',
    icon: '🎓' // Emoji for Open Campus
  },
  SEPOLIA: {
    id: 11155111, // Sepolia testnet
    name: 'Sepolia',
    icon: '🔷' // Emoji for Sepolia
  },
  ARB_SEPOLIA: {
    id: 421614, // Arbitrum Sepolia
    name: 'Arbitrum Sepolia',
    icon: '⚡' // Emoji for Arbitrum
  }
};

const WalletConnect = ({ onConnect, requiredNetwork = 'OPENCAMPUS' }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { initialize, error: clientError } = useMentoraContract();

  // Get the currently required network based on the prop
  const currentRequiredNetwork = NETWORKS[requiredNetwork] || NETWORKS.OPENCAMPUS;
  
  useEffect(() => {
    if (isConnected && address) {
      // Notify parent component when wallet connects
      if (onConnect) onConnect(address);
      
      // Initialize your contract if needed
      initialize?.();
    }
  }, [address, isConnected, onConnect, initialize]);

  const handleSwitchNetwork = () => {
    if (switchChain) {
      switchChain({ chainId: currentRequiredNetwork.id });
    }
  };

  const isOnRequiredNetwork = chainId === currentRequiredNetwork.id;

  return (
    <div className="flex items-center flex-wrap gap-4">
      {/* RainbowKit's ConnectButton handles wallet connection UI */}
      <ConnectButton showBalance={false} />
      
      {/* Show switch network button if connected but not on required network */}
      {isConnected && !isOnRequiredNetwork && (
        <button
          onClick={handleSwitchNetwork}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          <span>Switch to {currentRequiredNetwork.name}</span>
        </button>
      )}
      
      {/* Show network indicator if on required network */}
      {isConnected && isOnRequiredNetwork && (
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full flex items-center gap-2">
          <span>{currentRequiredNetwork.icon} {currentRequiredNetwork.name}</span>
        </div>
      )}
      
      {/* Display contract errors if any */}
      {clientError && (
        <div className="text-red-500 text-sm">
          Client error: {clientError}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;