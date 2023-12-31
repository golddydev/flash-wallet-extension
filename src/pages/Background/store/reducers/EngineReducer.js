import { SET_FEE_DATA, SET_GETTING_FEE_DATA_TIMER_ID } from '../types';

const initialState = {
  feeData: {},
  gettingFeeDataTimerId: -1,
};

const checkIfSame = (object1, object2) => {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    let o1 = object1[key];
    let o2 = object2[key];
    let child1Keys = Object.keys(o1);
    let child2Keys = Object.keys(o2);
    if (child1Keys.length != child2Keys.length) {
      return false;
    }
    for (let childKey of child1Keys) {
      if (!(o1[childKey].toString() === o2[childKey].toString())) {
        return false;
      }
    }
  }
  return true;
};

const EngineReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_FEE_DATA: {
      if (checkIfSame(action.payload, state.feeData)) {
        // console.log('Equal::::::::::');
        return state;
      } else {
        // console.log('Not Equal::::::::::: ');
        return {
          ...state,
          feeData: action.payload,
        };
      }
    }
    case SET_GETTING_FEE_DATA_TIMER_ID: {
      return {
        ...state,
        gettingFeeDataTimerId: action.payload,
      };
    }
    default: {
      return state;
    }
  }
};

export default EngineReducer;
