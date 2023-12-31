import { ethers } from 'ethers';
import browser from 'webextension-polyfill';

import {
  Token,
  WETH,
  Fetcher,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  Percent,
} from '@uniswap/sdk';
import { uniswapRouterAddress } from '../../../App/engine/constants';

const UNISWAP_ROUTER_ADDRESS = uniswapRouterAddress;
import UNISWAP_ROUTER_ABI from '../../../App/abis/uniswapRouterABI.json';

const approveRouter = async (provider, wallet, tokenAddress, amount) => {
  let approveAbi = [
    // approve
    {
      constant: true,
      inputs: [
        { name: '_spender', type: 'address' },
        { name: '_value', type: 'uint256' },
      ],
      name: 'approve',
      outputs: [{ name: 'success', type: 'bool' }],
      type: 'function',
    },
  ];
  const contract = new ethers.Contract(tokenAddress, approveAbi, provider);
  const approveTxn = await contract.populateTransaction.approve(
    UNISWAP_ROUTER_ADDRESS, //Router
    amount
  );
  console.log('Approve Txn:::::::: ', approveTxn);
  const txnRes = await wallet.sendTransaction(approveTxn);
  // console.log("Approve Txn Res::::::: ", txnRes);
  const txnReceipt = await txnRes.wait();
  console.log('Approve Txn Receipt:::::: ', txnReceipt);
};

export const swapToken = (
  dispatch,
  data,
  beforeWork,
  successCallback,
  failCallback,
  enqueueSnackbar
) => {
  const {
    currentNetwork,
    currentAccount,
    fromTokenData,
    toTokenData,
    fromValue,
    toValue,
    slippage,
    gasLimit,
    maxPriorityFee,
    maxFee,
  } = data;
  const provider = new ethers.providers.JsonRpcProvider(currentNetwork.rpc);
  const UNISWAP_ROUTER_CONTRACT = new ethers.Contract(
    UNISWAP_ROUTER_ADDRESS,
    UNISWAP_ROUTER_ABI,
    provider
  );
  const fromToken =
    fromTokenData == 'main'
      ? WETH[currentNetwork.chainId]
      : new Token(
          currentNetwork.chainId,
          fromTokenData.tokenAddress,
          fromTokenData.tokenDecimal,
          fromTokenData.tokenSymbol
        );
  const toToken =
    toTokenData == 'main'
      ? WETH[currentNetwork.chainId]
      : new Token(
          currentNetwork.chainId,
          toTokenData.tokenAddress,
          toTokenData.tokenDecimal,
          toTokenData.tokenSymbol
        );

  beforeWork();

  (() => {
    return new Promise(async (resolve, reject) => {
      try {
        const wallet = new ethers.Wallet(currentAccount.privateKey, provider);

        const pair = await Fetcher.fetchPairData(toToken, fromToken, provider); //creating instances of a pair
        const route = await new Route([pair], fromToken); // a fully specified path from input token to output token
        let amountIn = ethers.utils.parseEther(fromValue.toString()); //helper function to convert ETH to Wei
        amountIn = amountIn.toString();

        const slippageTolerance = new Percent(
          parseInt(Number(slippage) * 100),
          '10000'
        ); // 50 bips, or 0.50% - Slippage tolerance

        const trade = new Trade( //information necessary to create a swap transaction.
          route,
          new TokenAmount(fromToken, amountIn),
          TradeType.EXACT_INPUT
        );

        const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
        const amountInMax = trade.maximumAmountIn(slippageTolerance).raw;

        const amountOutMinHex = ethers.BigNumber.from(
          amountOutMin.toString()
        ).toHexString();
        const amountInMaxHex = ethers.BigNumber.from(
          amountInMax.toString()
        ).toHexString();
        const path = [fromToken.address, toToken.address]; //An array of token addresses
        const to = currentAccount.address; // should be a checksummed recipient address
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
        const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex
        const valueHex = await ethers.BigNumber.from(
          value.toString()
        ).toHexString(); //convert to hex string
        const amountInHex = valueHex;
        const amountOutValue = trade.outputAmount.raw;
        const amountOutHex = await ethers.BigNumber.from(
          amountOutValue.toString()
        ).toHexString(); //convert to hex string

        console.log('AmountInMax: ', amountInMax.toString(), amountInMaxHex);
        console.log(
          'AmountOutMin: ',
          amountOutValue.toString(),
          amountOutMinHex
        );
        console.log('AmountIn: ', value.toString(), amountInHex);
        console.log('AmountOut: ', amountOutValue.toString(), amountOutHex);

        let rawTxn;

        if (fromTokenData == 'main') {
          rawTxn =
            await UNISWAP_ROUTER_CONTRACT.populateTransaction.swapExactETHForTokens(
              amountOutMinHex,
              path,
              to,
              deadline,
              {
                value: valueHex,
                // gasLimit: gasLimit,
                maxPriorityFeePerGas: maxPriorityFee,
                maxFeePerGas: maxFee,
              }
            );
        } else if (toTokenData == 'main') {
          rawTxn =
            await UNISWAP_ROUTER_CONTRACT.populateTransaction.swapExactTokensForETH(
              amountInHex,
              amountOutMinHex,
              path,
              to,
              deadline,
              {
                // gasLimit: gasLimit,
                maxPriorityFeePerGas: maxPriorityFee,
                maxFeePerGas: maxFee,
              }
            );
        } else {
          rawTxn =
            await UNISWAP_ROUTER_CONTRACT.populateTransaction.swapExactTokensForTokens(
              amountInHex,
              amountOutMinHex,
              path,
              to,
              deadline,
              {
                // gasLimit: gasLimit,
                maxPriorityFeePerGas: maxPriorityFee,
                maxFeePerGas: maxFee,
              }
            );
        }

        console.log(rawTxn);
        await approveRouter(provider, wallet, fromToken.address, amountIn);
        const gasLimit = await wallet.estimateGas(rawTxn);
        console.log('Swap gaslimit: ', gasLimit);
        const refinedTxn = await wallet.populateTransaction(rawTxn);
        successCallback(refinedTxn);
        const txnRes = await wallet.sendTransaction(rawTxn);
        console.log('Swap Txn response::::: ', txnRes);
        const txnReceipt = await txnRes.wait();
        browser.notifications.create(txnReceipt.transactionHash.toString(), {
          type: 'basic',
          iconUrl: './assets/images/icon-128.png',
          title: 'Success',
          message: `Swap #${txnRes.nonce} is completed.`,
        });
        enqueueSnackbar(`Swap #${txnRes.nonce} is completed.`, {
          variant: 'success',
          style: {
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
          },
          anchorOrigin: {
            horizontal: 'center',
            vertical: 'bottom',
          },
        });
        console.log('Swap Txn Receipt:::: ', txnReceipt);
        resolve(gasLimit);
      } catch (err) {
        if (err.reason != 'cancelled') {
          browser.notifications.create(Math.random().toString(), {
            type: 'basic',
            iconUrl: './assets/images/icon-128.png',
            title: 'Error',
            message: JSON.stringify(err),
          });
          enqueueSnackbar(err.reason, {
            variant: 'error',
            style: {
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'white',
            },
            anchorOrigin: {
              horizontal: 'center',
              vertical: 'bottom',
            },
          });
        }
        failCallback(err);
        reject(err);
      }
    });
  })()
    .then((res) => {
      console.log(res);
    })
    .catch((err) => {
      console.log('Swap Tokens ERR:::::::', err);
    });
};
